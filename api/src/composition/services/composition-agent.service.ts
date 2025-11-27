import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from 'langchain';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';
import { Annotation, CompiledStateGraph, END, MessagesAnnotation, START, StateGraph, writer as graphWriter } from '@langchain/langgraph';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { UserService } from 'src/user/user.service';
import { MongoClient } from 'mongodb';


export interface ComposeAgentOptions {
  userPrompt: string;
  userId: string;
  threadId?: string;
  conversationId?: string;
}

export interface ResumeAgentOptions {
  conversationId: string;
  userResponse: string;
}

export type CompositionStreamEvent =
  | { type: 'start'; payload: { conversationId: string; threadId: string } }
  | { type: 'activity'; message: string }
  | { type: 'tool_start'; tool: string }
  | { type: 'tool_end'; tool: string }
  | { type: 'tool_error'; tool: string; message: string }
  | { type: 'draft_stream_started' }
  | { type: 'draft_chunk'; content: string }
  | { type: 'draft_stream_finished'; draft: string }
  | { type: 'error'; message: string };

interface ComposeExecutionConfig {
  writer?: (event: CompositionStreamEvent) => void;
  signal?: AbortSignal;
}

interface ComposeDraftContext {
  threadSummary: string;
  recipientSummary?: string | null;
  searchSummary?: string | null;
  calendarSummary?: string | null;
  vectorSummary?: string | null;
  dialogue?: BaseMessage[];
  userPrompt?: string | null;
  userId?: string | null;
  emailExamples?: string[];
}

interface ToolExecutionResult {
  message: string;
  activity?: string;
  searchSummary?: string;
  calendarSummary?: string;
  vectorSummary?: string;
}

type ToolHandler = (args: Record<string, any>, state: AgentStateType) => Promise<ToolExecutionResult>;

interface AgentToolDefinition {
  metadata: ReturnType<typeof tool>;
  handler: ToolHandler;
}

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  threadSummary: Annotation<string | null>(),
  recipientSummary: Annotation<string | null>(),
  searchSummary: Annotation<string | null>(),
  calendarSummary: Annotation<string | null>(),
  vectorSummary: Annotation<string | null>(),
  activity: Annotation<string[]>({
    reducer: (left: string[] = [], right: string | string[] | undefined) => {
      if (!right) {
        return left;
      }
      const updates = Array.isArray(right) ? right : [right];
      return left.concat(updates);
    },
    default: () => [],
  }),
  dialogueHistory: Annotation<BaseMessage[]>({
    reducer: (left: BaseMessage[] = [], right: BaseMessage | BaseMessage[]) => {
      const updates = Array.isArray(right) ? right : [right];
      return left.concat(updates);
    },
    default: () => [],
  }),
  streamingEnabled: Annotation<boolean>({
    reducer: (_left: boolean, right: boolean) => right,
    default: () => false,
  }),
  userId: Annotation<string | null>(),
  emailExamples: Annotation<string[] | null>(),
  threadId: Annotation<string | null>(),
  pendingUserPrompt: Annotation<string | null>(),
  latestUserPrompt: Annotation<string | null>({
    reducer: (left: string | null, right: string | null) => (right === undefined ? left ?? null : right),
    default: () => null,
  }),
});

type AgentStateType = typeof AgentState.State;

@Injectable()
export class CompositionAgentService implements OnModuleDestroy {
  private readonly logger = new Logger(CompositionAgentService.name);
  private readonly researchModel: ChatOpenAI;
  private readonly draftCreatorModel: ChatOpenAI;
  private readonly reasoningModel: { invoke: (messages: BaseMessage[], config?: unknown) => Promise<AIMessage> };
  private readonly toolHandlers: Record<string, ToolHandler>;
  private readonly agentGraph: CompiledStateGraph<any, any, any, any, any, any>;
  private readonly mongoClient: MongoClient;
  private readonly checkpointer: MongoDBSaver;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
    private readonly calendarService: CalendarService,
    private readonly userService: UserService,
  ) {
    this.researchModel = new ChatOpenAI({ model: 'gpt-4.1-mini' });
    this.draftCreatorModel = new ChatOpenAI({ model: 'gpt-4.1', temperature: 0 });

    const { client, checkpointer } = this.buildMongoCheckpointer();
    this.mongoClient = client;
    this.checkpointer = checkpointer;
    const toolDefinitions = this.buildAgentTools();
    this.toolHandlers = Object.fromEntries(toolDefinitions.map((definition) => [definition.metadata.name, definition.handler]));
    this.reasoningModel = this.researchModel.bindTools(toolDefinitions.map((definition) => definition.metadata));

    const builder = new StateGraph(AgentState)
      .addNode('load_thread', this.loadThreadNode.bind(this))
      .addNode('agent_loop', this.agentNode.bind(this))
      .addNode('tools', this.toolsNode.bind(this))
      .addNode('compose_draft', this.composeDraftNode.bind(this))
      .addEdge(START, 'load_thread')
      .addEdge('load_thread', 'agent_loop')
      .addConditionalEdges('agent_loop', this.routeFromAgent.bind(this))
      .addEdge('tools', 'agent_loop')
      .addEdge('compose_draft', END);

    this.agentGraph = builder.compile({
      checkpointer: this.checkpointer,
    });
  }

  async onModuleDestroy() {
    await this.mongoClient?.close();
  }

  async composeStream(
    options: ComposeAgentOptions,
    writer: (event: CompositionStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!options.threadId) {
      throw new Error('threadId is required to compose a draft.');
    }
    await this.executeCompose(options, { writer, signal });
  }

  private async executeCompose(
    options: ComposeAgentOptions,
    execConfig: ComposeExecutionConfig = {},
  ): Promise<void> {
    const conversationId = options.conversationId || this.buildConversationId(options.userId, options.threadId);


    execConfig.writer?.({ type: 'start', payload: { conversationId, threadId: options.threadId } });
    await this.agentGraph.invoke(
      {
        messages: [new HumanMessage(options.userPrompt)],
        activity: ['Received user request.'],
        userId: options.userId,
        threadId: options.threadId,
        pendingUserPrompt: options.userPrompt,
        latestUserPrompt: options.userPrompt,
        streamingEnabled: Boolean(execConfig.writer),
      },
      {
        configurable: {
          thread_id: conversationId,
          writer: execConfig.writer,
        },
        signal: execConfig.signal,
      },
    );
  }

  async getConversationState(conversationId: string): Promise<{
    conversationId: string;
    exists: boolean;
    messages?: Array<{ role: string; content: string; kind: 'user' | 'draft' }>;
  }> {
    try {
      // Use getState() on the compiled graph to retrieve saved state
      const state = await this.agentGraph.getState({
        configurable: { thread_id: conversationId },
      });

      if (!state || !state.values) {
        return { conversationId, exists: false };
      }

      // Extract user messages and draft messages from the state
      const messages: Array<{ role: string; content: string; kind: 'user' | 'draft' }> = [];
      const dialogueHistory = state.values.dialogueHistory || [];

      // Process dialogue history which contains user prompts and draft responses
      for (const msg of dialogueHistory) {
        if (msg instanceof HumanMessage) {
          const content = this.renderMessageContent(msg);
          if (content) {
            messages.push({ role: 'user', content, kind: 'user' });
          }
        } else if (msg instanceof AIMessage) {
          const content = this.renderMessageContent(msg);
          if (content) {
            messages.push({ role: 'assistant', content, kind: 'draft' });
          }
        }
      }

      return {
        conversationId,
        exists: messages.length > 0,
        messages: messages.length > 0 ? messages : undefined,
      };
    } catch (error) {
      // If state doesn't exist, getState might throw - that's fine, conversation doesn't exist
      this.logger.debug(`Conversation state not found for ${conversationId}: ${error instanceof Error ? error.message : error}`);
      return { conversationId, exists: false };
    }
  }

  private buildAgentTools(): AgentToolDefinition[] {
    return [
      {
        metadata: tool(async () => '', {
          name: 'search_related_emails',
          description: 'Search the mailbox for related historical context.',
          schema: z.object({
            query: z.string().optional(),
          }),
        }),
        handler: this.handleSearchTool.bind(this),
      },
      {
        metadata: tool(async () => '', {
          name: 'calendar_lookup',
          description: 'Fetch upcoming availability from the calendar for scheduling replies.',
          schema: z.object({
            lookAheadDays: z.number().int().positive().max(60).optional(),
          }),
        }),
        handler: this.handleCalendarTool.bind(this),
      },
      {
        metadata: tool(async () => '', {
          name: 'vector_lookup',
          description: 'Search the internal knowledge base for additional context.',
          schema: z.object({
            topic: z.string().optional(),
          }),
        }),
        handler: this.handleVectorTool.bind(this),
      },
    ];
  }

  private async loadThreadNode(state: AgentStateType) {
    if (!state.userId || !state.threadId) {
      throw new Error('User ID and thread ID are required before loading the thread.');
    }

    try {
      this.emitEvent({ type: 'activity', message: 'Loading Gmail thread…' });
      const thread = await this.gmailService.getThread(state.userId, state.threadId);
      const summary = this.gmailService.summarizeThread(thread);
      const recipientSummary = this.gmailService.buildRecipientSummary(thread);
      this.emitEvent({ type: 'activity', message: 'Loaded Gmail thread context.' });
      return {
        threadSummary: summary,
        recipientSummary,
        pendingUserPrompt: state.pendingUserPrompt,
        activity: 'Loaded Gmail thread context.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitEvent({ type: 'error', message: `Failed to load thread: ${message}` });
      throw new Error(`Failed to load Gmail thread: ${message}`);
    }
  }

  private async agentNode(state: AgentStateType) {
    const instructionMessage = new SystemMessage(this.buildAgentLoopPrompt(state));
    const history = state.messages ?? [];
    const aiResponse = await this.reasoningModel.invoke(
      [instructionMessage, ...history],
      {
        configurable: {
          threadId: state.threadId ?? undefined,
          userId: state.userId ?? undefined,
        },
      },
    );
    return {
      messages: [aiResponse],
      pendingUserPrompt: null,
      latestUserPrompt: state.pendingUserPrompt ?? state.latestUserPrompt ?? null,
    };
  }

  private async toolsNode(state: AgentStateType) {
    const lastAI = this.extractLastAIMessage(state.messages);
    if (!lastAI?.tool_calls?.length) {
      return {
        activity: 'Agent attempted to execute tools without specifying any tool calls.',
      };
    }

    const results = await Promise.all(
      lastAI.tool_calls.map(async (call) => {
        const handler = this.toolHandlers[call.name];
        if (!handler) {
          const unknownMessage = `Unknown tool "${call.name}" requested.`;
          return {
            toolMessage: new ToolMessage({ content: unknownMessage, tool_call_id: call.id }),
            activity: unknownMessage,
          };
        }

        try {
          this.emitEvent({ type: 'tool_start', tool: call.name });
          const result = await handler(call.args ?? {}, state);
          this.emitEvent({ type: 'tool_end', tool: call.name });
          return {
            toolMessage: new ToolMessage({ content: result.message, tool_call_id: call.id }),
            activity: result.activity,
            searchSummary: result.searchSummary,
            calendarSummary: result.calendarSummary,
            vectorSummary: result.vectorSummary,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.emitEvent({ type: 'tool_error', tool: call.name, message });
          return {
            toolMessage: new ToolMessage({ content: `Tool execution failed: ${message}`, tool_call_id: call.id }),
            activity: `⚠️ ${call.name} failed: ${message}`,
          };
        }
      }),
    );

    const toolMessages = results.map((result) => result.toolMessage);
    const activityUpdates = results
      .map((result) => result.activity)
      .filter((entry): entry is string => Boolean(entry));
    const summaryUpdates = results.reduce<Partial<Pick<AgentStateType, 'searchSummary' | 'calendarSummary' | 'vectorSummary'>>>(
      (acc, result) => {
        if (result.searchSummary) {
          acc.searchSummary = result.searchSummary;
        }
        if (result.calendarSummary) {
          acc.calendarSummary = result.calendarSummary;
        }
        if (result.vectorSummary) {
          acc.vectorSummary = result.vectorSummary;
        }
        return acc;
      },
      {},
    );

    return {
      messages: toolMessages,
      activity: activityUpdates,
      ...summaryUpdates,
    };
  }

  private async composeDraftNode(state: AgentStateType) {
    if (!state.threadSummary) {
      throw new Error('Thread summary missing prior to composing draft.');
    }
    const lastAI = this.extractLastAIMessage(state.messages);
    if (!lastAI) {
      throw new Error('Agent did not provide final drafting instructions.');
    }
    this.emitEvent({ type: 'activity', message: 'Generating email draft…' });
    const draft = await this.generateDraft({
      threadSummary: state.threadSummary,
      recipientSummary: state.recipientSummary,
      searchSummary: state.searchSummary,
      calendarSummary: state.calendarSummary,
      vectorSummary: state.vectorSummary,
      dialogue: state.dialogueHistory,
      userPrompt: state.latestUserPrompt,
      userId: state.userId,
      emailExamples: state.emailExamples ?? [],
    }, Boolean(state.streamingEnabled));
    const draftDialogueMessage = new AIMessage(draft);
    const dialogueUpdates: BaseMessage[] = [];
    if (state.latestUserPrompt) {
      dialogueUpdates.push(new HumanMessage(state.latestUserPrompt));
    }
    dialogueUpdates.push(draftDialogueMessage);
    return {
      activity: 'Email draft generated.',
      dialogueHistory: dialogueUpdates,
    };
  }

  private routeFromAgent(state: AgentStateType) {
    const lastAI = this.extractLastAIMessage(state.messages);
    if (!lastAI) {
      throw new Error('Agent did not return a response.');
    }
    if (lastAI.tool_calls?.length) {
      return 'tools';
    }
    return 'compose_draft';
  }

  private buildAgentLoopPrompt(state: AgentStateType) {
    return [
      'You are the planning agent responsible for deciding whether there is enough context to draft the reply.',
      'Evaluate the currently available context. If key information is missing, call one or more tools in parallel to fetch it:',
      '- search_related_emails: previous relevant conversations or references.',
      '- calendar_lookup: scheduling and availability details.',
      '- vector_lookup: internal knowledge base summaries.',
      'Once you determine that the context is sufficient, DO NOT call any tools.',
      'Just finish executing.',
      'Never ask the human follow-up questions.',
      'Never respond to the user directly.',
      state.threadSummary ? `<email_thread_summary>\n${state.threadSummary}\n<email_thread_summary>` : '',
    ].join('\n');
  }

  private async handleSearchTool(args: { query?: string }, state: AgentStateType): Promise<ToolExecutionResult> {
    if (!state.userId) {
      throw new Error('User context is missing for search.');
    }
    const query = args.query || this.deriveSearchQuery(state.threadSummary);
    if (!query) {
      return {
        message: 'Search skipped because no query was provided.',
        activity: 'Historical search skipped (no query).',
      };
    }
    const searchResults = await this.gmailService.listMessages(state.userId, undefined, 5, query);
    const ids = (searchResults.messages ?? []).map((message) => message.id).filter(Boolean) as string[];
    if (!ids.length) {
      return {
        message: 'No matching historical emails.',
        activity: 'No matching historical emails found.',
      };
    }
    const messages = await this.gmailService.getMessagesBulk(state.userId, ids, 'full');
    const summary = this.gmailService.summarizeMessages(messages);
    return {
      message: summary,
      activity: 'Historical email context captured.',
      searchSummary: summary,
    };
  }

  private async handleCalendarTool(
    args: { lookAheadDays?: number },
    state: AgentStateType,
  ): Promise<ToolExecutionResult> {
    if (!state.userId) {
      throw new Error('User context is missing for calendar lookup.');
    }
    const days = args.lookAheadDays ?? 14;
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const events = await this.calendarService.getCalendarEvents(state.userId, {
      timeMin,
      timeMax,
      maxResults: 10,
    });
    const summary = this.summarizeCalendar(events);
    return {
      message: summary,
      activity: 'Calendar availability retrieved.',
      calendarSummary: summary,
    };
  }

  private async handleVectorTool(
    args: { topic?: string },
    _state: AgentStateType,
  ): Promise<ToolExecutionResult> {
    const topic = args.topic || 'general';
    const summary = `Vector search placeholder invoked for topic: ${topic}.`;
    return {
      message: summary,
      activity: 'Vector knowledge base consulted.',
      vectorSummary: summary,
    };
  }

  private async generateDraft(context: ComposeDraftContext, streamingEnabled: boolean) {
    const user = await this.userService.findById(context.userId);
    const contextSections = [
      context.threadSummary && `<email_thread_summary>\n${context.threadSummary}\n<email_thread_summary>`,
      context.recipientSummary && `<persons_involved>\n${context.recipientSummary}\n<persons_involved>`,
      context.searchSummary && `<past_emails>:\n${context.searchSummary}\n<past_emails>`,
      context.calendarSummary && `<calendar_availability>${context.calendarSummary}\n<calendar_availability>`,
      context.vectorSummary && `<knowledge_base>\n${context.vectorSummary}\n<knowledge_base>`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const examplesSection = context.emailExamples?.length ?
      `Here is examples of ${user?.name}'s voice:
      ${context.emailExamples.map((example) => `<example>${example}</example>`).join('\n')}` :
      [`Always write naturally and casually, like a regular person—not as a robot, template, or overly-formal writer.`,
        `Do not include generic statements; make the email specific to the user's request/context. If in doubt, prioritize clarity, specificity, and a conversational tone.`].join('\n');

    const promptMessages = [
      new SystemMessage([
        '#role',
        `You are an AI assistant specialising in replying to incoming emails to ${user?.name}'s Gmail email inbox.`,
        `\n#capabilities and limitations`,
        `You cannot send emails, you can create email drafts. Do not halucinate.`,
        `\n#rules`,
        `1. Write the body of a casual, natural-sounding email in response to the ${user?.name}'s input and any provided context.`,
        `2. Carefully review the ${user?.name}'s input and the surrounding context to understand how they want to respond.`,
        `3. Avoid vague or generic replies—address specific details and requests from the user or context whenever possible.`,
        `4. Write informally and conversationally, as a normal person would, and avoid stilted or overly formal language.`,
        `\n#response`,
        `Always reply with the email draft. Do not answer directly to the user message.`,
        `Reply in casual, modern, professional, concise writing style. Write email drafts in plaintext, not HTML format. Do not use em dashes.`,
        `You should sound like ${user?.name}. ${examplesSection}`,
        `\n#context`,
        `Use the following context to reference it when writing the email draft.`,
        `${contextSections}`
      ].join('\n')),
      ...context.dialogue,
      new HumanMessage(context.userPrompt)
    ];

    if (streamingEnabled) {
      this.emitEvent({ type: 'draft_stream_started' });
      let accumulated = '';
      const stream = await this.draftCreatorModel.stream(promptMessages);
      for await (const chunk of stream) {
        const chunkText = this.renderMessageContent(chunk);
        if (chunkText) {
          accumulated += chunkText;
          this.emitEvent({ type: 'draft_chunk', content: chunkText });
        }
      }
      this.emitEvent({ type: 'draft_stream_finished', draft: accumulated });
      return accumulated;
    }

    const response = await this.draftCreatorModel.invoke(promptMessages);
    return this.renderMessageContent(response);
  }

  private summarizeCalendar(events: any) {
    const items = events?.items ?? [];
    if (!items.length) {
      return 'No upcoming events in the selected window.';
    }
    return items
      .map((event: any) => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        const attendees = event.attendees?.map((a: any) => a.email).join(', ') || 'None';
        return `${event.summary || 'Untitled'} (${start} → ${end}, attendees: ${attendees})`;
      })
      .join('\n');
  }

  private deriveSearchQuery(threadSummary?: string | null) {
    const summary = (threadSummary ?? '').toLowerCase();
    if (summary.includes('invoice') || summary.includes('payment')) {
      return 'subject:(invoice OR payment)';
    }
    if (summary.includes('meeting') || summary.includes('schedule')) {
      return 'subject:(meeting OR schedule)';
    }
    return 'in:anywhere';
  }

  private extractLastAIMessage(messages: BaseMessage[]) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i] instanceof AIMessage) {
        return messages[i] as AIMessage;
      }
    }
    return null;
  }

  private renderMessageContent(message: BaseMessage) {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content.map((block) => ('text' in block ? block.text : JSON.stringify(block))).join('\n');
    }
    return String(message.content ?? '');
  }

  private emitEvent(event: CompositionStreamEvent) {
    try {
      graphWriter(event);
      return true;
    } catch {
      return false;
    }
  }

  private buildConversationId(userId: string, threadId?: string, reset = false) {
    const baseId = `composition-${userId}-${threadId}-${randomUUID()}`;
    return baseId;
  }

  private buildMongoCheckpointer(): { client: MongoClient; checkpointer: MongoDBSaver } {
    const uri =
      this.configService.get<string>('LANGGRAPH_MONGODB_URI');
    const dbName =
      this.configService.get<string>('LANGGRAPH_MONGODB_DB');
    const client = new MongoClient(uri);
    void client
      .connect()
      .then(() => this.logger.debug('LangGraph checkpointer connected to MongoDB.'))
      .catch((error) =>
        this.logger.error('LangGraph checkpointer failed to connect to MongoDB.', error instanceof Error ? error.stack : String(error)),
      );
    return {
      client,
      checkpointer: new MongoDBSaver({
        client,
        dbName,
      }),
    };
  }

  private extractDatabaseName(uri: string): string | undefined {
    try {
      const parsed = new URL(uri);
      const path = parsed.pathname?.replace(/^\//, '');
      return path || undefined;
    } catch {
      return undefined;
    }
  }
}


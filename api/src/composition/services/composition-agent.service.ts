import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from 'langchain';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';
import {
  Annotation,
  CompiledStateGraph,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
  writer as graphWriter,
} from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';

export type AgentDraftReady = {
  status: 'DRAFT_READY';
  draftContent: string;
  conversationId: string;
  messages: BaseMessage[];
  activityLog: string[];
};

export type AgentClarificationNeeded = {
  status: 'NEEDS_INPUT';
  question: string;
  conversationId: string;
  activityLog: string[];
};

export type AgentExecutionResult = AgentDraftReady | AgentClarificationNeeded;

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

interface SupervisorDraftResult {
  status: 'draft';
  draft: string;
  activity?: string[];
}

interface SupervisorClarificationResult {
  status: 'clarification';
  question: string;
  activity?: string[];
}

type SupervisorOutcome = SupervisorDraftResult | SupervisorClarificationResult;

export type CompositionStreamEvent =
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
  searchSummary?: string | null;
  calendarSummary?: string | null;
  vectorSummary?: string | null;
  instructions?: string;
  dialogue?: BaseMessage[];
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
  threadId: Annotation<string | null>(),
  pendingUserPrompt: Annotation<string | null>(),
});

type AgentStateType = typeof AgentState.State;

@Injectable()
export class CompositionAgentService {
  private readonly logger = new Logger(CompositionAgentService.name);
  private readonly supervisorModel: ChatOpenAI;
  private readonly workerModel: ChatOpenAI;
  private readonly reasoningModel: { invoke: (messages: BaseMessage[], config?: unknown) => Promise<AIMessage> };
  private readonly toolHandlers: Record<string, ToolHandler>;
  private readonly agentGraph: CompiledStateGraph<any, any, any, any, any, any>;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
    private readonly calendarService: CalendarService,
  ) {
    const modelName = this.configService.get<string>('COMPOSITION_AGENT_MODEL') || 'gpt-4o';
    this.supervisorModel = new ChatOpenAI({ model: modelName, temperature: 0 });
    this.workerModel = new ChatOpenAI({ model: modelName, temperature: 0.2 });

    const toolDefinitions = this.buildAgentTools();
    this.toolHandlers = Object.fromEntries(toolDefinitions.map((definition) => [definition.metadata.name, definition.handler]));
    this.reasoningModel = this.supervisorModel.bindTools(toolDefinitions.map((definition) => definition.metadata));

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
      checkpointer: new MemorySaver(),
    });
  }

  async compose(options: ComposeAgentOptions): Promise<AgentExecutionResult> {
    if (!options.threadId) {
      throw new Error('threadId is required to compose a draft.');
    }
    return this.executeCompose(options);
  }

  async composeStream(
    options: ComposeAgentOptions,
    writer: (event: CompositionStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<AgentExecutionResult> {
    if (!options.threadId) {
      throw new Error('threadId is required to compose a draft.');
    }
    return this.executeCompose(options, { writer, signal });
  }

  private async executeCompose(
    options: ComposeAgentOptions,
    execConfig: ComposeExecutionConfig = {},
  ): Promise<AgentExecutionResult> {
    const conversationId = options.conversationId || this.buildConversationId(options.userId, options.threadId);

    const finalState = await this.agentGraph.invoke(
      {
        messages: [],
        activity: ['Received user request.'],
        userId: options.userId,
        threadId: options.threadId,
        pendingUserPrompt: options.userPrompt,
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

    const outcome = this.parseSupervisorOutcome(this.extractLastAIMessage(finalState.messages));

    if (!outcome || outcome.status !== 'draft') {
      throw new Error('Supervisor must always produce a draft.');
    }

    return {
      status: 'DRAFT_READY',
      draftContent: outcome.draft,
      conversationId,
      messages: finalState.messages,
      activityLog: finalState.activity ?? [],
    };
  }

  async resume(_options: ResumeAgentOptions): Promise<AgentExecutionResult> {
    throw new Error('Clarification cycles are not supported in the current agent implementation.');
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
      const summary = this.summarizeThread(thread);
      this.emitEvent({ type: 'activity', message: 'Loaded Gmail thread context.' });
      return {
        threadSummary: summary,
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
    const userMessage = state.pendingUserPrompt ? new HumanMessage(state.pendingUserPrompt) : null;
    const history = state.messages ?? [];
    const aiResponse = await this.reasoningModel.invoke(
      [instructionMessage, ...history, ...(userMessage ? [userMessage] : [])],
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
      dialogueHistory: userMessage ? [userMessage] : [],
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
    const instructions = this.renderMessageContent(lastAI);
    this.emitEvent({ type: 'activity', message: 'Generating email draft…' });
    const draft = await this.generateDraft({
      threadSummary: state.threadSummary,
      searchSummary: state.searchSummary,
      calendarSummary: state.calendarSummary,
      vectorSummary: state.vectorSummary,
      instructions,
      dialogue: state.dialogueHistory,
    }, Boolean(state.streamingEnabled));
    const response = new AIMessage(
      JSON.stringify({
        status: 'draft',
        draft,
        activity: ['Email draft generated.'],
      }),
    );
    const draftDialogueMessage = new AIMessage(draft);
    return {
      messages: [response],
      activity: 'Email draft generated.',
      dialogueHistory: [draftDialogueMessage],
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
    const contextFlags = [
      state.threadSummary ? 'Thread context is loaded.' : 'Thread context missing (should never happen).',
      state.searchSummary ? 'Historical email summary available.' : 'No historical email context yet.',
      state.calendarSummary ? 'Calendar availability captured.' : 'No calendar availability captured.',
      state.vectorSummary ? 'Vector knowledge context available.' : 'No vector knowledge context gathered.',
    ];
    return [
      'You are the planning agent responsible for deciding whether there is enough context to draft the reply.',
      'Evaluate the currently available context. If key information is missing, call one or more tools in parallel to fetch it:',
      '- search_related_emails: previous relevant conversations or references.',
      '- calendar_lookup: scheduling and availability details.',
      '- vector_lookup: internal knowledge base summaries.',
      'Once you determine that the context is sufficient, DO NOT call any tools.',
      'Instead, respond with clear concise drafting instructions for the writing agent.',
      'Never ask the human follow-up questions.',
      'Never respond to the user directly, only provide drafting instructions for the writing agent.',
      '',
      state.threadSummary ? `Thread summary:\n${state.threadSummary}` : '',
      '',
      'Current context status:',
      ...contextFlags,
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
    const summary = this.summarizeSearchResults(messages);
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
    const contextSections = [
      context.threadSummary && `Thread context:\n${context.threadSummary}`,
      context.searchSummary && `Historical references:\n${context.searchSummary}`,
      context.calendarSummary && `Calendar availability:\n${context.calendarSummary}`,
      context.vectorSummary && `Knowledge base context:\n${context.vectorSummary}`,
      context.dialogue?.length && `Conversation so far:\n${this.renderDialogueTranscript(context.dialogue)}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const promptMessages = [
      new SystemMessage(
        'You are an expert email writer. Return only the body of the email. Do not include metadata or JSON.',
      ),
      new HumanMessage(
        [
          // context.instructions && `Supervisor note: ${context.instructions}`,
          contextSections || 'No additional context available.',
          'Compose the final email now.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    ];

    if (streamingEnabled) {
      this.emitEvent({ type: 'draft_stream_started' });
      let accumulated = '';
      const stream = await this.workerModel.stream(promptMessages);
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

    const response = await this.workerModel.invoke(promptMessages);
    return this.renderMessageContent(response);
  }

  private summarizeThread(thread: any) {
    const messages = thread?.messages ?? [];
    if (!messages.length) {
      return 'Thread is empty.';
    }
    const latest = messages.slice(-3);
    return latest
      .map((message: any, index: number) => {
        const from = this.extractHeader(message, 'from') || 'Unknown sender';
        const subject = this.extractHeader(message, 'subject') || 'No subject';
        const body = this.extractBody(message);
        const preview = body || message.snippet || '';
        return `Message #${messages.length - latest.length + index + 1}\nFrom: ${from}\nSubject: ${subject}\nBody:\n${preview}`;
      })
      .join('\n');
  }

  private summarizeSearchResults(messages: Array<any | null>) {
    if (!messages.length) {
      return 'No historical results.';
    }
    return messages
      .filter(Boolean)
      .map((message: any) => {
        const subject = this.extractHeader(message, 'subject') || 'No subject';
        const from = this.extractHeader(message, 'from') || 'Unknown sender';
        const body = this.extractBody(message) || message.snippet || '';
        return `Subject: ${subject}\nFrom: ${from}\nBody:\n${body}`;
      })
      .join('\n');
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

  private extractHeader(message: any, name: string) {
    const headers = message.payload?.headers ?? [];
    const header = headers.find((h: any) => h?.name?.toLowerCase() === name.toLowerCase());
    return header?.value;
  }

  private extractBody(message: any) {
    const payload = message.payload;
    if (!payload) {
      return '';
    }

    if (payload.body?.data) {
      return this.decodeBody(payload.body.data);
    }

    const parts = payload.parts ?? [];
    const textPart = parts.find((part: any) => part.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return this.decodeBody(textPart.body.data);
    }

    const htmlPart = parts.find((part: any) => part.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return this.stripHtml(this.decodeBody(htmlPart.body.data));
    }

    for (const part of parts) {
      if (part.body?.data) {
        return this.decodeBody(part.body.data);
      }
    }

    return '';
  }

  private decodeBody(data: string) {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractLastAIMessage(messages: BaseMessage[]) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i] instanceof AIMessage) {
        return messages[i] as AIMessage;
      }
    }
    return null;
  }

  private parseSupervisorOutcome(message: AIMessage | null): SupervisorOutcome | null {
    if (!message) {
      return null;
    }
    const content = this.renderMessageContent(message);
    try {
      const parsed = JSON.parse(content);
      if (parsed.status === 'draft' && typeof parsed.draft === 'string') {
        return { status: 'draft', draft: parsed.draft, activity: parsed.activity };
      }
      if (parsed.status === 'clarification' && typeof parsed.question === 'string') {
        return { status: 'clarification', question: parsed.question, activity: parsed.activity };
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to parse supervisor response: ${error instanceof Error ? error.message : error}`);
      return null;
    }
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

  private renderDialogueTranscript(messages: BaseMessage[]) {
    return messages
      .map((message) => {
        const type = message.getType();
        let speaker = 'Agent';
        if (type === 'human') {
          speaker = 'User';
        } else if (type === 'ai') {
          speaker = 'Agent';
        } else if (type === 'tool') {
          speaker = 'Tool';
        }
        const content = this.renderMessageContent(message);
        if (!content) {
          return null;
        }
        return `${speaker}: ${content}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  private buildConversationId(userId: string, threadId?: string) {
    if (threadId) {
      return `composition-${userId}-${threadId}`;
    }
    return `composition-${userId}-${randomUUID()}`;
  }
}


import { Injectable, Logger } from '@nestjs/common';
import {
  Annotation,
  Command,
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
  interrupt,
  isGraphInterrupt,
} from '@langchain/langgraph';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  createGmailSearchTool,
  createGmailThreadLoaderTool,
  createGoogleCalendarTool,
  createHumanInputTool,
} from '../tools';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';
import { StructuredToolInterface } from '@langchain/core/tools';

const AgentAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  threadId: Annotation<string | undefined>({
    reducer: (_prev, next) => next ?? _prev,
    default: () => undefined,
  }),
  userId: Annotation<string>({
    reducer: (_prev, next) => next ?? _prev,
    default: () => '',
  }),
  userPrompt: Annotation<string>({
    reducer: (_prev, next) => next ?? _prev,
    default: () => '',
  }),
  requiresUserInput: Annotation<boolean>({
    reducer: (_prev, next) => (typeof next === 'boolean' ? next : _prev),
    default: () => false,
  }),
  clarificationQuestion: Annotation<string | undefined>({
    reducer: (_prev, next) => next ?? _prev,
    default: () => undefined,
  }),
  activityLog: Annotation<string[]>({
    reducer: (prev, next) => {
      const nextValues = Array.isArray(next) ? next : next ? [next] : [];
      return [...(prev ?? []), ...nextValues];
    },
    default: () => [],
  }),
});

type AgentState = typeof AgentAnnotation.State;

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

@Injectable()
export class CompositionAgentService {
  private readonly logger = new Logger(CompositionAgentService.name);
  private readonly tools: StructuredToolInterface[];
  private readonly toolsByName: Record<string, StructuredToolInterface>;
  private readonly systemPrompt: string;
  private readonly model: ChatOpenAI;
  private readonly modelWithTools: ReturnType<ChatOpenAI['bindTools']>;
  private readonly checkpointer = new MemorySaver();
  private readonly graph;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
    private readonly calendarService: CalendarService,
  ) {
    this.tools = [
      createGmailThreadLoaderTool(this.gmailService),
      createGmailSearchTool(this.gmailService),
      createGoogleCalendarTool(this.calendarService),
      createHumanInputTool(),
    ];
    this.toolsByName = this.tools.reduce<Record<string, StructuredToolInterface>>((acc, tool) => {
      acc[tool.name] = tool;
      return acc;
    }, {});

    this.systemPrompt = [
      'You are an email composition assistant. Your goal is to draft professional, context-aware Gmail replies.',
      'Always reference available context and keep tone helpful and concise.',
      'Available tools:',
      '- load_gmail_thread: Retrieve the full conversation history.',
      '- search_gmail: Search historical emails for more context.',
      '- get_calendar_events: Review calendar availability for scheduling.',
      '- ask_user_for_clarification: Request missing information from the user.',
      'Guidelines:',
      '1. Load the Gmail thread when a threadId is provided.',
      '2. Search Gmail history if user references earlier conversations.',
      '3. Use calendar tool when proposing times.',
      '4. Ask clarifying questions if the user intent is unclear.',
      '5. Produce a polished email draft that can be sent as-is.',
      '6. Include relevant context and action steps.',
    ].join('\n');

    const modelName = this.configService.get<string>('COMPOSITION_AGENT_MODEL') || 'gpt-4o-mini';
    this.model = new ChatOpenAI({
      model: modelName,
      temperature: 0.2,
    });
    // bindTools returns a ChatOpenAI instance aware of the provided tools for function calling
    this.modelWithTools = this.model.bindTools(this.tools);
    this.graph = this.buildGraph();
  }

  async compose(options: ComposeAgentOptions): Promise<AgentExecutionResult> {
    const conversationId = options.conversationId || this.buildConversationId(options.userId, options.threadId);
    const initialState: AgentState = {
      messages: [
        this.buildSystemMessage(options),
        new HumanMessage({
          content: options.userPrompt,
        }),
      ],
      threadId: options.threadId,
      userId: options.userId,
      userPrompt: options.userPrompt,
      requiresUserInput: false,
      clarificationQuestion: undefined,
      activityLog: ['Received user request.'],
    };

    try {
      const result = await this.graph.invoke(initialState, {
        configurable: {
          thread_id: conversationId,
        },
      });
      return this.toExecutionResult(result, conversationId);
    } catch (error) {
      if (isGraphInterrupt(error)) {
        const question = error.interrupts?.[0]?.value?.question || 'Additional information is required.';
        return {
          status: 'NEEDS_INPUT',
          question,
          conversationId,
          activityLog: [...(initialState.activityLog ?? []), 'Awaiting clarification…'],
        };
      }
      this.logger.error('Agent invocation failed', error as Error);
      throw error;
    }
  }

  async resume(options: ResumeAgentOptions): Promise<AgentExecutionResult> {
    const command = new Command({
      resume: options.userResponse,
    });

    try {
      const result = await this.graph.invoke(command, {
        configurable: {
          thread_id: options.conversationId,
        },
      });
      return this.toExecutionResult(result, options.conversationId);
    } catch (error) {
      if (isGraphInterrupt(error)) {
        const question = error.interrupts?.[0]?.value?.question || 'Additional information is required.';
        return {
          status: 'NEEDS_INPUT',
          question,
          conversationId: options.conversationId,
          activityLog: ['Awaiting clarification…'],
        };
      }
      this.logger.error('Agent resume failed', error as Error);
      throw error;
    }
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentAnnotation)
      .addNode('agent', this.agentNode.bind(this))
      .addNode('tools', this.toolsNode.bind(this))
      .addNode('human', this.humanNode.bind(this))
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', this.routeFromAgent.bind(this))
      .addConditionalEdges('tools', this.routeFromTools.bind(this))
      .addEdge('human', 'agent');

    return workflow.compile({
      checkpointer: this.checkpointer,
    });
  }

  private async agentNode(state: AgentState, config?: RunnableConfig) {
    const response = await this.modelWithTools.invoke(state.messages, config);
    return {
      messages: [response],
      activityLog: ['Generating draft...'],
    };
  }

  private async toolsNode(state: AgentState, config?: RunnableConfig) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
      return {};
    }

    const toolMessages: ToolMessage[] = [];
    const activityEntries: string[] = [];
    let requiresHuman = false;
    let clarificationQuestion: string | undefined;

    const toolDescriptions: Record<string, string> = {
      load_gmail_thread: 'Loading Gmail thread…',
      search_gmail: 'Searching Gmail history…',
      get_calendar_events: 'Checking calendar availability…',
      ask_user_for_clarification: 'Requesting clarification…',
    };

    for (const call of lastMessage.tool_calls) {
      const tool = this.toolsByName[call.name];
      if (!tool) {
        toolMessages.push(
          new ToolMessage({
            content: `Tool "${call.name}" is not available.`,
            tool_call_id: call.id,
          }),
        );
        continue;
      }

      const parsedArgs = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
      const enrichedArgs = {
        ...parsedArgs,
        userId: state.userId,
      };

      const description = toolDescriptions[call.name] || `Running ${call.name}…`;
      activityEntries.push(description);
      let result: unknown;
      try {
        result = await tool.invoke(enrichedArgs, config);
      } catch (error) {
        if (isGraphInterrupt(error)) {
          requiresHuman = true;
          const questionFromInterrupt =
            (error.interrupts?.[0]?.value?.question as string | undefined) ??
            parsedArgs?.question ??
            'Additional details required.';
          clarificationQuestion = questionFromInterrupt;
          activityEntries.push(`Clarification needed: ${questionFromInterrupt}`);
          result = `Clarification requested: ${questionFromInterrupt}`;
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Tool "${call.name}" failed: ${errorMessage}`);
          activityEntries.push(`⚠️ ${description} failed: ${errorMessage}`);
          result = `Tool "${call.name}" failed: ${errorMessage}`;
        }
      }
      if (call.name === 'ask_user_for_clarification' && parsedArgs?.question) {
        requiresHuman = true;
        clarificationQuestion = clarificationQuestion ?? parsedArgs.question;
      }

      toolMessages.push(
        new ToolMessage({
          content: typeof result === 'string' ? result : JSON.stringify(result),
          tool_call_id: call.id,
        }),
      );
    }

    return {
      messages: toolMessages,
      requiresUserInput: requiresHuman,
      clarificationQuestion,
      activityLog: activityEntries,
    };
  }

  private async humanNode(state: AgentState) {
    if (!state.clarificationQuestion) {
      return { requiresUserInput: false };
    }

    const userResponse = await interrupt({
      question: state.clarificationQuestion,
    });

    return {
      messages: [
        new HumanMessage({
          content: userResponse,
        }),
      ],
      requiresUserInput: false,
      clarificationQuestion: undefined,
      activityLog: ['Received clarification from user.'],
    };
  }

  private routeFromAgent(state: AgentState) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    if (lastMessage instanceof AIMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
      return 'tools';
    }
    return END;
  }

  private routeFromTools(state: AgentState) {
    if (state.requiresUserInput) {
      return 'human';
    }
    return 'agent';
  }

  private toExecutionResult(state: AgentState, conversationId: string): AgentExecutionResult {
    if (state.requiresUserInput && state.clarificationQuestion) {
      return {
        status: 'NEEDS_INPUT',
        question: state.clarificationQuestion,
        conversationId,
        activityLog: state.activityLog ?? [],
      };
    }

    const messages = state.messages || [];
    const lastAssistantMessage = [...messages].reverse().find((message) => message.getType() === 'ai');

    const draftContent =
      lastAssistantMessage && 'content' in lastAssistantMessage && typeof lastAssistantMessage.content === 'string'
        ? lastAssistantMessage.content
        : '';

    return {
      status: 'DRAFT_READY',
      draftContent,
      conversationId,
      messages,
      activityLog: state.activityLog ?? [],
    };
  }

  private buildConversationId(userId: string, threadId?: string) {
    if (threadId) {
      return `composition-${userId}-${threadId}`;
    }
    return `composition-${userId}-${randomUUID()}`;
  }

  private buildSystemMessage(options: ComposeAgentOptions) {
    const metadataLines = [
      'Conversation metadata:',
      `- userId: ${options.userId}`,
      `- threadId: ${options.threadId ?? 'not provided'}`,
    ].join('\n');

    return new SystemMessage(`${this.systemPrompt}\n\n${metadataLines}`);
  }
}



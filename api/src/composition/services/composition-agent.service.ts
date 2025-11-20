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
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage,  } from 'langchain';
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
});

type AgentState = typeof AgentAnnotation.State;

export type AgentDraftReady = {
  status: 'DRAFT_READY';
  draftContent: string;
  conversationId: string;
  messages: BaseMessage[];
};

export type AgentClarificationNeeded = {
  status: 'NEEDS_INPUT';
  question: string;
  conversationId: string;
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
        new SystemMessage(this.systemPrompt),
        new HumanMessage({
          content: options.userPrompt,
        }),
      ],
      threadId: options.threadId,
      userId: options.userId,
      userPrompt: options.userPrompt,
      requiresUserInput: false,
      clarificationQuestion: undefined,
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
    };
  }

  private async toolsNode(state: AgentState, config?: RunnableConfig) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls?.length) {
      return {};
    }

    const toolMessages: ToolMessage[] = [];
    let requiresHuman = false;
    let clarificationQuestion: string | undefined;

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

      const result = await tool.invoke(enrichedArgs, config);
      if (call.name === 'ask_user_for_clarification' && parsedArgs?.question) {
        requiresHuman = true;
        clarificationQuestion = parsedArgs.question;
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
    };
  }

  private buildConversationId(userId: string, threadId?: string) {
    if (threadId) {
      return `composition-${userId}-${threadId}`;
    }
    return `composition-${userId}-${randomUUID()}`;
  }
}



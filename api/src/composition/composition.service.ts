import { Injectable } from '@nestjs/common';
import { ComposeDraftAgentInput, ResumeDraftCompositionInput } from './dto/compose-draft-agent.dto';
import {
  AgentExecutionResult,
  CompositionAgentService,
  CompositionStreamEvent,
} from './services/composition-agent.service';

@Injectable()
export class CompositionService {
  constructor(private readonly compositionAgentService: CompositionAgentService) {}

  async composeDraftWithAgent(userId: string, input: ComposeDraftAgentInput): Promise<AgentExecutionResult> {
    return this.compositionAgentService.compose({
      userPrompt: input.userPrompt,
      userId: userId.toString(),
      threadId: input.threadId,
      conversationId: input.conversationId,
    });
  }

  async composeDraftStreamWithAgent(
    userId: string,
    input: ComposeDraftAgentInput,
    writer: (event: CompositionStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<AgentExecutionResult> {
    return this.compositionAgentService.composeStream(
      {
        userPrompt: input.userPrompt,
        userId: userId.toString(),
        threadId: input.threadId,
        conversationId: input.conversationId,
      },
      writer,
      signal,
    );
  }

  async resumeDraftComposition(input: ResumeDraftCompositionInput): Promise<AgentExecutionResult> {
    return this.compositionAgentService.resume({
      conversationId: input.conversationId,
      userResponse: input.userResponse,
    });
  }

  async getConversationState(conversationId: string) {
    return this.compositionAgentService.getConversationState(conversationId);
  }

  async resetConversation(userId: string, threadId: string) {
    return this.compositionAgentService.resetConversation(userId, threadId);
  }
}



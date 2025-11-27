import { Injectable } from '@nestjs/common';
import { ComposeDraftAgentInput } from './dto/compose-draft-agent.dto';
import {
  CompositionAgentService,
  CompositionStreamEvent,
} from './services/composition-agent.service';

@Injectable()
export class CompositionService {
  constructor(private readonly compositionAgentService: CompositionAgentService) { }

  async composeDraftStreamWithAgent(
    userId: string,
    input: ComposeDraftAgentInput,
    writer: (event: CompositionStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.compositionAgentService.composeStream(
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

  async getConversationState(conversationId: string) {
    return this.compositionAgentService.getConversationState(conversationId);
  }
}



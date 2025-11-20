import { Injectable } from '@nestjs/common';
import { ComposeDraftAgentInput, ResumeDraftCompositionInput } from './dto/compose-draft-agent.dto';
import { AgentExecutionResult, CompositionAgentService } from './services/composition-agent.service';

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

  async resumeDraftComposition(input: ResumeDraftCompositionInput): Promise<AgentExecutionResult> {
    return this.compositionAgentService.resume({
      conversationId: input.conversationId,
      userResponse: input.userResponse,
    });
  }
}



import { Resolver, Query, Args } from '@nestjs/graphql';
import {
  ConversationState,  
} from './dto/compose-draft-agent.dto';
import { CompositionService } from './composition.service';

@Resolver()
export class CompositionResolver {
  constructor(
    private compositionService: CompositionService,
  ) {    
  }

  @Query(() => ConversationState)
  async getConversationState(
    @Args('conversationId') conversationId: string,
  ): Promise<ConversationState> {
    return this.compositionService.getConversationState(conversationId);
  }
}


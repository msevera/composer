import { Resolver, Mutation, Context, Args } from '@nestjs/graphql';
import { VectorSearchService } from '../indexing/services/vector-search.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { DraftCompositionInput, DraftCompositionResult } from './dto/draft-composition.dto';
import {
  ClarificationRequired,
  ComposeDraftAgentInput,
  ComposeDraftAgentResponse,
  DraftResult,
  ResumeDraftCompositionInput,
} from './dto/compose-draft-agent.dto';
import { CompositionService } from './composition.service';
import { AgentExecutionResult } from './services/composition-agent.service';

@Resolver()
export class CompositionResolver {
  private openai: OpenAI;

  constructor(
    private vectorSearchService: VectorSearchService,
    private configService: ConfigService,
    private compositionService: CompositionService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Compose email draft using RAG
   */
  @Mutation(() => DraftCompositionResult)  
  async composeDraft(
    @Context() context: any,
    @Args('input') input: DraftCompositionInput,
  ): Promise<DraftCompositionResult> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    if (!input.threadId) {
      throw new Error('threadId is required when composing Gmail drafts');
    }

   
    return {
      content: `This is a Gmail draft. ${userId} ${input.prompt} ${input.threadId}`,
      sources: [],
    };
  }

  @Mutation(() => ComposeDraftAgentResponse)
  async composeDraftWithAgent(
    @Context() context: any,
    @Args('input') input: ComposeDraftAgentInput,
  ): Promise<typeof ComposeDraftAgentResponse> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;
    const result = await this.compositionService.composeDraftWithAgent(userId.toString(), input);
    return this.mapAgentResult(result);
  }

  @Mutation(() => ComposeDraftAgentResponse)
  async resumeDraftComposition(
    @Args('input') input: ResumeDraftCompositionInput,
  ): Promise<typeof ComposeDraftAgentResponse> {
    const result = await this.compositionService.resumeDraftComposition(input);
    return this.mapAgentResult(result);
  }

  private mapAgentResult(result: AgentExecutionResult): DraftResult | ClarificationRequired {
    if (result.status === 'NEEDS_INPUT') {
      return {
        status: result.status,
        question: result.question,
        conversationId: result.conversationId,
      };
    }

    return {
      status: result.status,
      draftContent: result.draftContent,
      conversationId: result.conversationId,
    };
  }

  /**
   * Compose tweet reply using RAG
   */
  @Mutation(() => DraftCompositionResult)
  async composeTweet(
    @Context() context: any,
    @Args('input') input: DraftCompositionInput,
  ): Promise<DraftCompositionResult> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Search vector store
    const relevantContext = await this.vectorSearchService.searchRelevantContext(
      userId.toString(),
      input.prompt,
      {
        sources: ['twitter', 'notion'],
        limit: 15,
        filters: {
          $or: [
            { 'metadata.isOwnTweet': true },
            { 'metadata.threadId': input.threadId },
          ],
        },
        sourceWeights: { twitter: 1.2, notion: 0.8 },
      },
    );

    const ownTweets = relevantContext.filter((r) => r.metadata?.isOwnTweet);
    const threadTweets = relevantContext.filter((r) => r.metadata?.threadId === input.threadId);

    const systemPrompt = `You are a Twitter reply assistant. Compose a tweet that:
- Matches the user's writing style
- Fits the conversation context
- Is concise (under 280 characters)

User's past tweets (for style):
${ownTweets.map((r) => r.content).join('\n')}

Current thread context:
${threadTweets.map((r) => r.content).join('\n')}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.prompt },
      ],
      max_tokens: 100,
    });

    return {
      content: completion.choices[0].message.content || '',
      sources: relevantContext.map((r) => r.source),
    };
  }
}


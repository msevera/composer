import { Resolver, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { VectorSearchService } from '../indexing/services/vector-search.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { DraftCompositionInput, DraftCompositionResult } from './dto/draft-composition.dto';

@Resolver()
export class CompositionResolver {
  private openai: OpenAI;

  constructor(
    private vectorSearchService: VectorSearchService,
    private configService: ConfigService,
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
  @UseGuards(AuthGuard)
  async composeDraft(
    @Context() context: any,
    @Args('input') input: DraftCompositionInput,
  ): Promise<DraftCompositionResult> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Search vector store for relevant context
    const relevantContext = await this.vectorSearchService.searchRelevantContext(
      userId.toString(),
      input.prompt,
      {
        sources: ['notion'],
        limit: 10,
        filters: input.threadId ? { 'metadata.threadId': input.threadId } : {},
      },
    );

    // Build LLM prompt
    const systemPrompt = `You are an email assistant. Use the following context to compose a response:

${relevantContext.map((r) => `[${r.source.toUpperCase()}] ${r.content}`).join('\n\n')}`;

    // Call LLM
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.prompt },
      ],
    });

    return {
      content: completion.choices[0].message.content || '',
      sources: relevantContext.map((r) => r.source),
    };
  }

  /**
   * Compose tweet reply using RAG
   */
  @Mutation(() => DraftCompositionResult)
  @UseGuards(AuthGuard)
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


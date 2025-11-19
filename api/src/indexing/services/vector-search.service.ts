import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotionEmbedding, NotionEmbeddingDocument } from '../schemas/notion-embedding.schema';
import { TwitterEmbedding, TwitterEmbeddingDocument } from '../schemas/twitter-embedding.schema';
import { EmbeddingService } from './embedding.service';

export interface SearchResult {
  content: string;
  metadata: any;
  score: number;
  source: 'notion' | 'twitter';
}

export interface SearchOptions {
  sources?: ('notion' | 'twitter')[];
  limit?: number;
  filters?: Record<string, any>;
  sourceWeights?: Record<string, number>;
}

@Injectable()
export class VectorSearchService {
  constructor(
    @InjectModel(NotionEmbedding.name) private notionEmbeddingModel: Model<NotionEmbeddingDocument>,
    @InjectModel(TwitterEmbedding.name) private twitterEmbeddingModel: Model<TwitterEmbeddingDocument>,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Search across all sources with vector similarity
   */
  async searchRelevantContext(
    userId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Determine which sources to search
    const sources = options.sources || ['notion', 'twitter'];
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (sources.includes('notion')) {
      searchPromises.push(this.searchNotion(userId, queryEmbedding, options));
    }
    if (sources.includes('twitter')) {
      searchPromises.push(this.searchTwitter(userId, queryEmbedding, options));
    }

    // Execute searches in parallel
    const results = await Promise.all(searchPromises);
    const flatResults = results.flat();

    // Apply source weights and re-rank
    return this.mergeAndRank(flatResults, options.sourceWeights || {});
  }

  /**
   * Search Notion embeddings
   */
  private async searchNotion(
    userId: string,
    embedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'notion_vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: 100,
          limit: options.limit || 20,
          filter: { userId, ...options.filters },
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await this.notionEmbeddingModel.aggregate(pipeline);

    return results.map((r) => ({
      content: r.content,
      metadata: r.metadata,
      score: r.score,
      source: 'notion' as const,
    }));
  }

  /**
   * Search Twitter embeddings
   */
  private async searchTwitter(
    userId: string,
    embedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'twitter_vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: 100,
          limit: options.limit || 20,
          filter: { userId, ...options.filters },
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await this.twitterEmbeddingModel.aggregate(pipeline);

    return results.map((r) => ({
      content: r.content,
      metadata: r.metadata,
      score: r.score,
      source: 'twitter' as const,
    }));
  }

  /**
   * Merge and rank results with source weights
   */
  private mergeAndRank(
    results: SearchResult[],
    sourceWeights: Record<string, number>,
  ): SearchResult[] {
    // Apply source-specific weights
    const weighted = results.map((result) => ({
      ...result,
      weightedScore: result.score * (sourceWeights[result.source] || 1.0),
    }));

    // Sort by weighted score descending
    return weighted.sort((a, b) => b.weightedScore - a.weightedScore);
  }
}


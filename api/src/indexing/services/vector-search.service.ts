import { Injectable } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

export interface SearchResult {
  content: string;
  metadata: any;
  score: number;
  source: string;
}

export interface SearchOptions {
  sources?: string[];
  limit?: number;
  filters?: Record<string, any>;
  sourceWeights?: Record<string, number>;
}

@Injectable()
export class VectorSearchService {
  constructor(
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Search across all sources with vector similarity
   * Currently returns empty array as all sources (Notion, Twitter) have been removed
   */
  async searchRelevantContext(
    userId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    // All sources (Notion, Twitter) have been removed
    // Return empty array for now
    return [];
  }
}


import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings in batch (up to 100 texts)
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      batches.push(texts.slice(i, i + 100));
    }

    const results: number[][] = [];
    for (const batch of batches) {
      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
        });
        results.push(...response.data.map(d => d.embedding));
      } catch (error) {
        console.error('Error in batch embedding generation:', error);
        throw error;
      }
    }

    return results;
  }
}

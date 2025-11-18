import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { EmailEmbedding, EmailEmbeddingDocument } from './schemas/email-embedding.schema';
import { EmailIndexingService } from './email-indexing.service';

@Injectable()
export class EmailSearchService {
  constructor(
    @InjectModel(EmailEmbedding.name) private embeddingModel: Model<EmailEmbeddingDocument>,
    @Inject(getConnectionToken()) private connection: Connection,
    private emailIndexingService: EmailIndexingService,
  ) {}

  /**
   * Search for similar emails using vector similarity search
   * This uses MongoDB Atlas Vector Search
   */
  async searchSimilarEmails(
    userId: string,
    queryEmbedding: number[],
    limit: number = 10,
  ): Promise<Array<{
    emailId: string;
    chunkText: string;
    chunkIndex: number;
    score: number;
  }>> {
    const db = this.connection.db;
    const collection = db.collection('email-embeddings');

    // MongoDB Atlas Vector Search aggregation pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: 'email_embedding_index', // This will be created in MongoDB Atlas
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit,
        },
      },
      {
        $match: {
          userId: userId.toString(),
        },
      },
      {
        $project: {
          emailId: 1,
          chunkText: 1,
          chunkIndex: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    try {
      const results = await collection.aggregate(pipeline).toArray();
      return results.map((r) => ({
        emailId: r.emailId,
        chunkText: r.chunkText,
        chunkIndex: r.chunkIndex,
        score: r.score || 0,
      }));
    } catch (error) {
      console.error('Vector search error:', error);
      // Fallback: if vector search index doesn't exist, return empty array
      // In production, you'd want to handle this more gracefully
      return [];
    }
  }

  /**
   * Find emails related to a specific message
   */
  async findRelatedEmails(
    userId: string,
    messageId: string,
    limit: number = 5,
  ): Promise<Array<{
    emailId: string;
    chunkText: string;
    score: number;
  }>> {
    // Get embeddings for the source email
    const sourceEmbeddings = await this.embeddingModel
      .find({ userId: userId.toString(), emailId: messageId })
      .exec();

    if (sourceEmbeddings.length === 0) {
      return [];
    }

    // Use the first chunk's embedding for similarity search
    const queryEmbedding = sourceEmbeddings[0].embedding;

    const results = await this.searchSimilarEmails(userId, queryEmbedding, limit + 1);

    // Filter out the source email itself
    return results
      .filter((r) => r.emailId !== messageId)
      .slice(0, limit)
      .map((r) => ({
        emailId: r.emailId,
        chunkText: r.chunkText,
        score: r.score,
      }));
  }

  /**
   * Search emails by text query (generates embedding and searches)
   */
  async searchEmailsByText(
    userId: string,
    queryText: string,
    limit: number = 10,
  ): Promise<Array<{
    emailId: string;
    chunkText: string;
    score: number;
  }>> {
    // Generate embedding for the query text
    const queryEmbedding = await this.emailIndexingService.generateEmbedding(queryText);

    // Search for similar emails
    return this.searchSimilarEmails(userId, queryEmbedding, limit);
  }
}


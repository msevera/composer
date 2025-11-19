# Complete MongoDB Vector Store Implementation Plan (GraphQL-Based)

## Overview

This unified plan establishes a MongoDB-based vector store architecture to index Gmail emails, Notion pages, and Twitter posts for RAG-powered content composition across multiple platforms. The system uses **GraphQL for all API interactions** (no REST endpoints), **separate collections per data source** with **denormalized metadata**, and supports both **background indexing** (user-owned content) and **on-demand indexing** (contextual content like Twitter threads). The web dashboard displays **multi-platform indexing status only** (no email listing UI).

---

## Phase 1: MongoDB Schema Architecture

### 1.1 Remove Old Schemas

**Delete these files:**
- `/api/src/email/schemas/email.schema.ts`
- `/api/src/email/schemas/email-embedding.schema.ts`

### 1.2 Create New Unified Embedding Schemas

Create directory: `/api/src/indexing/schemas/`

#### A. Gmail Embedding Schema

**File:** `/api/src/indexing/schemas/gmail-embedding.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GmailEmbeddingDocument = GmailEmbedding & Document;

@Schema({ timestamps: true })
export class GmailEmbedding {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  emailId: string; // Gmail message ID

  @Prop({ required: true })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[]; // 1536-dim vector

  @Prop({ required: true })
  content: string; // Original text chunk

  @Prop({ type: Object, required: true })
  metadata: {
    from: string;
    to: string[];
    subject: string;
    date: Date;
    threadId: string;
    labels: string[];
    snippet: string;
    position: string; // 'subject' | 'body_start' | 'body_middle' | 'body_end'
    hasAttachments: boolean;
  };

  @Prop()
  syncToken?: string; // Gmail API history token

  createdAt?: Date;
  updatedAt?: Date;
}

export const GmailEmbeddingSchema = SchemaFactory.createForClass(GmailEmbedding);

// Indexes
GmailEmbeddingSchema.index({ userId: 1, emailId: 1, chunkIndex: 1 });
GmailEmbeddingSchema.index({ userId: 1, syncToken: 1 });
GmailEmbeddingSchema.index({ 'metadata.threadId': 1 });
```

#### B. Gmail Sync State Schema

**File:** `/api/src/indexing/schemas/gmail-sync-state.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GmailSyncStateDocument = GmailSyncState & Document;

@Schema({ timestamps: true })
export class GmailSyncState {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop()
  historyId?: string; // Gmail API history ID

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ enum: ['idle', 'syncing', 'completed', 'error'], default: 'idle' })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: 0 })
  totalEmailsIndexed: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const GmailSyncStateSchema = SchemaFactory.createForClass(GmailSyncState);
```

#### C. Notion Embedding Schema

**File:** `/api/src/indexing/schemas/notion-embedding.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotionEmbeddingDocument = NotionEmbedding & Document;

@Schema({ timestamps: true })
export class NotionEmbedding {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  pageId: string;

  @Prop({ required: true })
  blockId: string;

  @Prop({ default: 0 })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ required: true })
  content: string;

  @Prop({ type: Object, required: true })
  metadata: {
    pageTitle: string;
    workspaceId: string;
    parentPageId?: string;
    breadcrumb: string[]; // ['Workspace', 'Parent Page', 'Current Page']
    blockType: string; // 'paragraph', 'heading_1', etc.
    hasChildren: boolean;
    createdTime: Date;
    lastEditedTime: Date;
    tags?: string[];
    databaseId?: string;
  };

  @Prop()
  syncCursor?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotionEmbeddingSchema = SchemaFactory.createForClass(NotionEmbedding);

// Indexes
NotionEmbeddingSchema.index({ userId: 1, pageId: 1 });
NotionEmbeddingSchema.index({ userId: 1, syncCursor: 1 });
NotionEmbeddingSchema.index({ 'metadata.lastEditedTime': -1 });
```

#### D. Notion Sync State Schema

**File:** `/api/src/indexing/schemas/notion-sync-state.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotionSyncStateDocument = NotionSyncState & Document;

@Schema({ timestamps: true })
export class NotionSyncState {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop()
  cursor?: string;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ enum: ['idle', 'syncing', 'completed', 'error'], default: 'idle' })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: 0 })
  totalPagesIndexed: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotionSyncStateSchema = SchemaFactory.createForClass(NotionSyncState);
```

#### E. Twitter Embedding Schema

**File:** `/api/src/indexing/schemas/twitter-embedding.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TwitterEmbeddingDocument = TwitterEmbedding & Document;

@Schema({ timestamps: true })
export class TwitterEmbedding {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  tweetId: string;

  @Prop({ default: 0 })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ required: true })
  content: string;

  @Prop({ type: Object, required: true })
  metadata: {
    authorHandle: string;
    authorName: string;
    authorId: string;
    isOwnTweet: boolean;
    threadId?: string;
    conversationId?: string;
    parentTweetId?: string;
    threadPosition?: number;
    likes: number;
    retweets: number;
    replies: number;
    createdAt: Date;
    hashtags: string[];
    mentions: string[];
    urls: string[];
    hasMedia: boolean;
    mediaTypes?: string[];
    isTemporary: boolean; // For on-demand indexed threads
    indexedReason: string; // 'user_content' | 'thread_context'
  };

  @Prop()
  syncCursor?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TwitterEmbeddingSchema = SchemaFactory.createForClass(TwitterEmbedding);

// Indexes
TwitterEmbeddingSchema.index({ userId: 1, tweetId: 1 });
TwitterEmbeddingSchema.index({ userId: 1, 'metadata.threadId': 1 });
TwitterEmbeddingSchema.index({ userId: 1, 'metadata.isOwnTweet': 1 });
TwitterEmbeddingSchema.index({ 'metadata.conversationId': 1 });

// TTL Index for temporary thread context (expires after 48 hours)
TwitterEmbeddingSchema.index(
  { 'metadata.isTemporary': 1, createdAt: 1 },
  { expireAfterSeconds: 172800 }
);
```

#### F. Twitter Sync State Schema

**File:** `/api/src/indexing/schemas/twitter-sync-state.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TwitterSyncStateDocument = TwitterSyncState & Document;

@Schema({ timestamps: true })
export class TwitterSyncState {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop()
  newestTweetId?: string;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ enum: ['idle', 'syncing', 'completed', 'error'], default: 'idle' })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: 0 })
  totalTweetsIndexed: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TwitterSyncStateSchema = SchemaFactory.createForClass(TwitterSyncState);
```

---

## Phase 2: Indexing Services Architecture

### 2.1 Delete Old Services

**Remove these files:**
- `/api/src/email/email-indexing.service.ts`
- `/api/src/email/email.service.ts`
- `/api/src/email/email-indexing.queue.ts`
- `/api/src/email/email-indexing.processor.ts`

**Keep:**
- `/api/src/gmail/gmail.service.ts` (for Gmail API interactions)

### 2.2 Create New Service Structure

Create directory: `/api/src/indexing/services/`

#### A. Embedding Service (OpenAI)

**File:** `/api/src/indexing/services/embedding.service.ts`

```typescript
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
```

#### B. Gmail Indexer Service

**File:** `/api/src/indexing/services/gmail-indexer.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GmailEmbedding, GmailEmbeddingDocument } from '../schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateDocument } from '../schemas/gmail-sync-state.schema';
import { EmbeddingService } from './embedding.service';
import { GmailService } from '../../gmail/gmail.service';
import { convert } from 'html-to-text';

@Injectable()
export class GmailIndexerService {
  constructor(
    @InjectModel(GmailEmbedding.name) private embeddingModel: Model<GmailEmbeddingDocument>,
    @InjectModel(GmailSyncState.name) private syncStateModel: Model<GmailSyncStateDocument>,
    private embeddingService: EmbeddingService,
    private gmailService: GmailService,
  ) {}

  /**
   * Initial bulk indexing (last 7 days of emails)
   */
  async indexUserEmails(userId: string): Promise<{ indexed: number; errors: number }> {
    // Update sync state to 'syncing'
    await this.syncStateModel.findOneAndUpdate(
      { userId },
      { status: 'syncing', errorMessage: null },
      { upsert: true }
    );

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const query = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;

      let indexed = 0;
      let errors = 0;
      let pageToken: string | undefined;

      do {
        const result = await this.gmailService.listMessages(userId, pageToken, 50, query);
        
        if (!result.messages || result.messages.length === 0) {
          break;
        }

        const messageIds = result.messages.map(msg => msg.id);
        const messageDataArray = await this.gmailService.getMessagesBulk(
          userId,
          messageIds,
          'full',
          10
        );

        for (const messageData of messageDataArray) {
          if (messageData) {
            try {
              await this.indexMessageWithEmbeddings(userId, messageData);
              indexed++;
            } catch (error) {
              console.error(`Error indexing message ${messageData.id}:`, error);
              errors++;
            }
          } else {
            errors++;
          }
        }

        pageToken = result.nextPageToken;
      } while (pageToken);

      // Update sync state
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        {
          status: 'completed',
          lastSyncedAt: new Date(),
          totalEmailsIndexed: indexed,
        }
      );

      return { indexed, errors };
    } catch (error) {
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { status: 'error', errorMessage: error.message }
      );
      throw error;
    }
  }

  /**
   * Incremental sync using Gmail history API
   */
  async incrementalSync(userId: string): Promise<void> {
    const syncState = await this.syncStateModel.findOne({ userId });
    if (!syncState?.historyId) {
      console.log('No historyId found, skipping incremental sync');
      return;
    }

    try {
      // Use Gmail history API to get changes
      const history = await this.gmailService.getHistory(userId, syncState.historyId);
      
      if (!history || !history.history) {
        return;
      }

      // Process added messages
      for (const historyItem of history.history) {
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            const messageData = await this.gmailService.getMessage(userId, added.message.id);
            await this.indexMessageWithEmbeddings(userId, messageData);
          }
        }

        // Process deleted messages
        if (historyItem.messagesDeleted) {
          for (const deleted of historyItem.messagesDeleted) {
            await this.embeddingModel.deleteMany({
              userId,
              emailId: deleted.message.id,
            });
          }
        }
      }

      // Update historyId
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { historyId: history.historyId, lastSyncedAt: new Date() }
      );
    } catch (error) {
      console.error('Error in incremental sync:', error);
      throw error;
    }
  }

  /**
   * Index single message with embeddings
   */
  private async indexMessageWithEmbeddings(userId: string, messageData: any): Promise<void> {
    const messageId = messageData.id;

    // Check if already indexed
    const existing = await this.embeddingModel.findOne({ userId, emailId: messageId });
    if (existing) {
      return;
    }

    // Extract metadata
    const headers = messageData.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('subject');
    const from = getHeader('from');
    const to = (getHeader('to') || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const dateHeader = getHeader('date');
    const date = dateHeader ? new Date(dateHeader) : new Date();

    // Extract body text
    const bodyText = this.extractBodyText(messageData);
    if (!bodyText) {
      console.log(`No body content for message ${messageId}`);
      return;
    }

    // Preprocess and chunk
    const cleanedText = await this.preprocessEmailContent(bodyText, subject, from);
    const chunks = this.splitIntoChunks(cleanedText);

    // Generate embeddings in batch
    const embeddings = await this.embeddingService.batchGenerateEmbeddings(chunks);

    // Store embeddings
    const embeddingDocs = chunks.map((chunk, index) => ({
      userId,
      emailId: messageId,
      chunkIndex: index,
      embedding: embeddings[index],
      content: chunk,
      metadata: {
        from,
        to,
        subject,
        date,
        threadId: messageData.threadId,
        labels: messageData.labelIds || [],
        snippet: messageData.snippet || '',
        position: index === 0 ? 'subject' : index === chunks.length - 1 ? 'body_end' : 'body_middle',
        hasAttachments: this.hasAttachments(messageData.payload),
      },
    }));

    await this.embeddingModel.insertMany(embeddingDocs);
  }

  /**
   * Preprocess email content
   */
  private async preprocessEmailContent(
    emailBody: string,
    subject: string,
    from: string,
  ): Promise<string> {
    if (!emailBody) return '';

    let text = emailBody;
    if (emailBody.includes('<') && emailBody.includes('>')) {
      text = convert(emailBody, {
        wordwrap: false,
        preserveNewlines: true,
      });
    }

    // Remove signatures and quoted replies
    text = text.replace(/--\s*\n[\s\S]*$/, '');
    text = text.split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Add context
    const context = `Subject: ${subject}\nFrom: ${from}\n\n`;
    text = context + text;

    // Truncate if too long (~2000 chars)
    const maxLength = 2000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }

    return text;
  }

  /**
   * Split text into chunks (~500 tokens = ~2000 chars)
   */
  private splitIntoChunks(text: string): string[] {
    const maxChars = 2000;
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 <= maxChars) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        if (paragraph.length > maxChars) {
          const sentences = paragraph.split(/[.!?]+\s+/);
          let sentenceChunk = '';
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length + 1 <= maxChars) {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            } else {
              if (sentenceChunk) chunks.push(sentenceChunk);
              sentenceChunk = sentence;
            }
          }
          currentChunk = sentenceChunk;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
  }

  /**
   * Extract body text from Gmail message
   */
  private extractBodyText(message: any): string {
    const payload = message.payload;
    if (!payload) return '';

    let bodyText = '';

    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data && !bodyText) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          const nestedText = this.extractBodyFromParts(part.parts);
          if (nestedText) {
            bodyText = nestedText;
            break;
          }
        }
      }
    }

    return bodyText;
  }

  private extractBodyFromParts(parts: any[]): string {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        const nested = this.extractBodyFromParts(part.parts);
        if (nested) return nested;
      }
    }
    return '';
  }

  private hasAttachments(payload: any): boolean {
    if (!payload || !payload.parts) return false;
    
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        return true;
      }
      if (part.parts && this.hasAttachments(part)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<GmailSyncStateDocument | null> {
    return this.syncStateModel.findOne({ userId });
  }
}
```

#### C. Vector Search Service

**File:** `/api/src/indexing/services/vector-search.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { GmailEmbedding, GmailEmbeddingDocument } from '../schemas/gmail-embedding.schema';
import { NotionEmbedding, NotionEmbeddingDocument } from '../schemas/notion-embedding.schema';
import { TwitterEmbedding, TwitterEmbeddingDocument } from '../schemas/twitter-embedding.schema';
import { EmbeddingService } from './embedding.service';

export interface SearchResult {
  content: string;
  metadata: any;
  score: number;
  source: 'gmail' | 'notion' | 'twitter';
}

export interface SearchOptions {
  sources?: ('gmail' | 'notion' | 'twitter')[];
  limit?: number;
  filters?: Record<string, any>;
  sourceWeights?: Record<string, number>;
}

@Injectable()
export class VectorSearchService {
  constructor(
    @InjectModel(GmailEmbedding.name) private gmailEmbeddingModel: Model<GmailEmbeddingDocument>,
    @InjectModel(NotionEmbedding.name) private notionEmbeddingModel: Model<NotionEmbeddingDocument>,
    @InjectModel(TwitterEmbedding.name) private twitterEmbeddingModel: Model<TwitterEmbeddingDocument>,
    @InjectConnection() private connection: Connection,
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
    const sources = options.sources || ['gmail', 'notion', 'twitter'];
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (sources.includes('gmail')) {
      searchPromises.push(this.searchGmail(userId, queryEmbedding, options));
    }
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
   * Search Gmail embeddings
   */
  private async searchGmail(
    userId: string,
    embedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    // MongoDB Vector Search aggregation
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'gmail_vector_index',
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

    const results = await this.gmailEmbeddingModel.aggregate(pipeline);

    return results.map((r) => ({
      content: r.content,
      metadata: r.metadata,
      score: r.score,
      source: 'gmail' as const,
    }));
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
```

---

## Phase 3: GraphQL Resolvers

### 3.1 Remove Old Email Listing Resolvers

**Update:** `/api/src/email/email.resolver.ts`

Remove these queries:
- `emails`
- `emailThreads`
- `emailThread`
- `emailContent`

Keep and update:
- `indexInitialEmails` mutation
- `hasInitialIndexingCompleted` query
- `isIndexingInProgress` query

### 3.2 Create New Indexing Resolver

**File:** `/api/src/indexing/indexing.resolver.ts`

```typescript
import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { IndexingStatus, PlatformIndexingStatus } from './entities/indexing-status.entity';

@Resolver()
export class IndexingResolver {
  constructor(
    private gmailIndexerService: GmailIndexerService,
    // Add other indexers when ready: NotionIndexerService, TwitterIndexerService
  ) {}

  /**
   * Get indexing status for specific platform
   */
  @Query(() => PlatformIndexingStatus)
  @UseGuards(AuthGuard)
  async getIndexingStatus(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<PlatformIndexingStatus> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      
      return {
        platform: 'gmail',
        status: syncState?.status || 'idle',
        totalIndexed: syncState?.totalEmailsIndexed || 0,
        lastSyncedAt: syncState?.lastSyncedAt,
        errorMessage: syncState?.errorMessage,
      };
    }

    // Add support for 'notion' and 'twitter' later
    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Get indexing status for all platforms
   */
  @Query(() => [PlatformIndexingStatus])
  @UseGuards(AuthGuard)
  async getAllIndexingStatuses(@Context() context: any): Promise<PlatformIndexingStatus[]> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    const gmailStatus = await this.gmailIndexerService.getSyncStatus(userId.toString());

    return [
      {
        platform: 'gmail',
        status: gmailStatus?.status || 'idle',
        totalIndexed: gmailStatus?.totalEmailsIndexed || 0,
        lastSyncedAt: gmailStatus?.lastSyncedAt,
        errorMessage: gmailStatus?.errorMessage,
      },
      // Add Notion and Twitter when ready
    ];
  }

  /**
   * Start indexing for specific platform
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async startIndexing(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      // Check if already indexing
      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      if (syncState?.status === 'syncing') {
        return 'Gmail indexing already in progress';
      }

      // Start indexing (background job)
      this.gmailIndexerService.indexUserEmails(userId.toString()).catch((error) => {
        console.error('Gmail indexing error:', error);
      });

      return 'Gmail indexing started';
    }

    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Trigger manual sync for specific platform
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async triggerSync(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      await this.gmailIndexerService.incrementalSync(userId.toString());
      return 'Gmail sync completed';
    }

    throw new Error(`Platform '${platform}' not supported`);
  }
}
```

**File:** `/api/src/indexing/entities/indexing-status.entity.ts`

```typescript
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PlatformIndexingStatus {
  @Field()
  platform: string; // 'gmail' | 'notion' | 'twitter'

  @Field()
  status: string; // 'idle' | 'syncing' | 'completed' | 'error'

  @Field()
  totalIndexed: number;

  @Field({ nullable: true })
  lastSyncedAt?: Date;

  @Field({ nullable: true })
  errorMessage?: string;
}

@ObjectType()
export class IndexingStatus {
  @Field(() => [PlatformIndexingStatus])
  platforms: PlatformIndexingStatus[];
}
```

### 3.3 Create Draft Composition Resolver

**File:** `/api/src/composition/composition.resolver.ts`

```typescript
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

    // Search vector store for relevant context
    const relevantContext = await this.vectorSearchService.searchRelevantContext(
      userId.toString(),
      input.prompt,
      {
        sources: ['gmail', 'notion'],
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
```

**File:** `/api/src/composition/dto/draft-composition.dto.ts`

```typescript
import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType()
export class DraftCompositionInput {
  @Field()
  prompt: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  conversationId?: string;

  @Field({ nullable: true })
  replyToId?: string;
}

@ObjectType()
export class DraftCompositionResult {
  @Field()
  content: string;

  @Field(() => [String])
  sources: string[];
}
```

---

## Phase 4: Web Dashboard (Multi-Platform Status)

### 4.1 Delete Old Email UI Pages

**Remove these files:**
- `/web/app/emails/page.tsx`
- `/web/app/emails/[messageId]/page.tsx`

### 4.2 Update Home Page with Multi-Platform Dashboard

**File:** `/web/app/page.tsx`

Replace the existing indexing status section with:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/better-auth-client';
import { useQuery, useMutation } from '@apollo/client';
import { apolloClient } from '@/lib/apollo-client';
import { gql } from '@apollo/client';

const GET_ALL_INDEXING_STATUSES = gql`
  query GetAllIndexingStatuses {
    getAllIndexingStatuses {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

const START_INDEXING = gql`
  mutation StartIndexing($platform: String!) {
    startIndexing(platform: $platform)
  }
`;

interface PlatformStatus {
  platform: string;
  status: string;
  totalIndexed: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  // Fetch indexing statuses
  const { data: statusData, refetch: refetchStatuses } = useQuery(
    GET_ALL_INDEXING_STATUSES,
    {
      client: apolloClient,
      skip: !isAuthenticated || !isGmailConnected,
      pollInterval: 3000, // Poll every 3 seconds
      fetchPolicy: 'network-only',
    }
  );

  const [startIndexing] = useMutation(START_INDEXING, {
    client: apolloClient,
  });

  const statuses: PlatformStatus[] = statusData?.getAllIndexingStatuses || [];

  const handleStartIndexing = async (platform: string) => {
    try {
      await startIndexing({ variables: { platform } });
      await refetchStatuses();
    } catch (error: any) {
      console.error(`Error starting ${platform} indexing:`, error);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'syncing':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Smail Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your multi-platform AI email assistant
        </p>
      </header>

      {isAuthenticated && isGmailConnected && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Indexing Status
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Gmail Status Card */}
            {statuses.find((s) => s.platform === 'gmail') && (
              <div
                className={`rounded-xl border p-4 ${getStatusColor(
                  statuses.find((s) => s.platform === 'gmail')?.status || 'idle'
                )}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Gmail</h3>
                  <span className="text-sm font-medium">
                    {statuses.find((s) => s.platform === 'gmail')?.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Emails Indexed:</span>{' '}
                    {statuses.find((s) => s.platform === 'gmail')?.totalIndexed || 0}
                  </div>
                  <div>
                    <span className="font-medium">Last Synced:</span>{' '}
                    {formatDate(
                      statuses.find((s) => s.platform === 'gmail')?.lastSyncedAt
                    )}
                  </div>
                </div>

                {statuses.find((s) => s.platform === 'gmail')?.status !== 'syncing' && (
                  <button
                    onClick={() => handleStartIndexing('gmail')}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    {statuses.find((s) => s.platform === 'gmail')?.totalIndexed > 0
                      ? 'Re-index'
                      : 'Start Indexing'}
                  </button>
                )}

                {statuses.find((s) => s.platform === 'gmail')?.status === 'syncing' && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm">Indexing in progress...</span>
                  </div>
                )}
              </div>
            )}

            {/* Notion Status Card (placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-600">Notion</h3>
                <span className="text-sm font-medium text-slate-500">COMING SOON</span>
              </div>
              <p className="text-sm text-slate-500">
                Connect your Notion workspace to index pages and databases.
              </p>
            </div>

            {/* Twitter Status Card (placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-600">Twitter</h3>
                <span className="text-sm font-medium text-slate-500">COMING SOON</span>
              </div>
              <p className="text-sm text-slate-500">
                Connect your Twitter account to index tweets and threads.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
```

### 4.3 Create GraphQL Queries File

**File:** `/web/lib/graphql/indexing-queries.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_ALL_INDEXING_STATUSES = gql`
  query GetAllIndexingStatuses {
    getAllIndexingStatuses {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

export const GET_INDEXING_STATUS = gql`
  query GetIndexingStatus($platform: String!) {
    getIndexingStatus(platform: $platform) {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

export const START_INDEXING = gql`
  mutation StartIndexing($platform: String!) {
    startIndexing(platform: $platform)
  }
`;

export const TRIGGER_SYNC = gql`
  mutation TriggerSync($platform: String!) {
    triggerSync(platform: $platform)
  }
`;
```

**File:** `/web/lib/graphql/composition-queries.ts`

```typescript
import { gql } from '@apollo/client';

export const COMPOSE_DRAFT = gql`
  mutation ComposeDraft($input: DraftCompositionInput!) {
    composeDraft(input: $input) {
      content
      sources
    }
  }
`;

export const COMPOSE_TWEET = gql`
  mutation ComposeTweet($input: DraftCompositionInput!) {
    composeTweet(input: $input) {
      content
      sources
    }
  }
`;
```

---

## Phase 5: Module Configuration

### 5.1 Create Indexing Module

**File:** `/api/src/indexing/indexing.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GmailEmbedding, GmailEmbeddingSchema } from './schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateSchema } from './schemas/gmail-sync-state.schema';
import { NotionEmbedding, NotionEmbeddingSchema } from './schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateSchema } from './schemas/notion-sync-state.schema';
import { TwitterEmbedding, TwitterEmbeddingSchema } from './schemas/twitter-embedding.schema';
import { TwitterSyncState, TwitterSyncStateSchema } from './schemas/twitter-sync-state.schema';
import { EmbeddingService } from './services/embedding.service';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { VectorSearchService } from './services/vector-search.service';
import { IndexingResolver } from './indexing.resolver';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailEmbedding.name, schema: GmailEmbeddingSchema },
      { name: GmailSyncState.name, schema: GmailSyncStateSchema },
      { name: NotionEmbedding.name, schema: NotionEmbeddingSchema },
      { name: NotionSyncState.name, schema: NotionSyncStateSchema },
      { name: TwitterEmbedding.name, schema: TwitterEmbeddingSchema },
      { name: TwitterSyncState.name, schema: TwitterSyncStateSchema },
    ]),
    GmailModule,
  ],
  providers: [
    EmbeddingService,
    GmailIndexerService,
    VectorSearchService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    GmailIndexerService,
    VectorSearchService,
  ],
})
export class IndexingModule {}
```

### 5.2 Create Composition Module

**File:** `/api/src/composition/composition.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CompositionResolver } from './composition.resolver';
import { IndexingModule } from '../indexing/indexing.module';

@Module({
  imports: [IndexingModule],
  providers: [CompositionResolver],
})
export class CompositionModule {}
```

### 5.3 Update App Module

**File:** `/api/src/app.module.ts`

Add imports:

```typescript
import { IndexingModule } from './indexing/indexing.module';
import { CompositionModule } from './composition/composition.module';

@Module({
  imports: [
    // ... existing imports
    IndexingModule,
    CompositionModule,
  ],
  // ...
})
export class AppModule {}
```

---

## Phase 6: Chrome Extension Integration

### 6.1 Universal Composer Injector

**File:** `/extension/src/content-scripts/universal-injector.ts`

```typescript
class UniversalComposerInjector {
  private injector: GmailDraftInjector | TwitterReplyInjector | null = null;
  
  private detectPlatform(): 'gmail' | 'twitter' | null {
    const hostname = window.location.hostname;
    
    if (hostname.includes('mail.google.com')) return 'gmail';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    
    return null;
  }
  
  async initialize() {
    const platform = this.detectPlatform();
    
    if (platform === 'gmail') {
      this.injector = new GmailDraftInjector();
      this.renderInputField({ position: 'bottom-fixed', context: 'email' });
    } else if (platform === 'twitter') {
      this.injector = new TwitterReplyInjector();
      this.renderInputField({ position: 'floating', context: 'tweet' });
    }
  }
  
  private renderInputField(config: { position: string, context: string }) {
    const inputContainer = document.createElement('div');
    inputContainer.id = 'smail-composer-input';
    inputContainer.style.cssText = `
      position: fixed;
      ${config.position === 'bottom-fixed' ? 'bottom: 20px;' : 'bottom: 80px;'}
      right: 20px;
      width: 400px;
      z-index: 10000;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
    `;
    
    inputContainer.innerHTML = `
      <textarea 
        id="smail-prompt-input" 
        placeholder="Describe the ${config.context} you want to compose..."
        style="width: 100%; height: 80px; border: 1px solid #ddd; border-radius: 4px; padding: 8px;"
      ></textarea>
      <button 
        id="smail-generate-btn"
        style="margin-top: 8px; padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Generate ${config.context === 'email' ? 'Draft' : 'Reply'}
      </button>
    `;
    
    document.body.appendChild(inputContainer);
    
    document.getElementById('smail-generate-btn')?.addEventListener('click', () => {
      this.handlePromptSubmit();
    });
  }
  
  private extractContext(platform: 'gmail' | 'twitter'): any {
    if (platform === 'gmail') {
      const match = window.location.hash.match(/#inbox\/([a-zA-Z0-9]+)/);
      return { threadId: match ? match[1] : null };
    } else if (platform === 'twitter') {
      const match = window.location.href.match(/status\/(\d+)/);
      return { threadId: match ? match[1] : null };
    }
    return {};
  }
  
  async handlePromptSubmit() {
    const platform = this.detectPlatform();
    if (!platform || !this.injector) return;
    
    const promptInput = document.getElementById('smail-prompt-input') as HTMLTextAreaElement;
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    
    try {
      const mutation = platform === 'gmail' ? 'composeDraft' : 'composeTweet';
      
      // Call GraphQL API
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getUserToken()}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          query: `
            mutation {
              ${mutation}(input: {
                prompt: "${prompt.replace(/"/g, '\\"')}"
                ${this.extractContext(platform).threadId ? `threadId: "${this.extractContext(platform).threadId}"` : ''}
              }) {
                content
                sources
              }
            }
          `,
        }),
      });
      
      const result = await response.json();
      const content = result.data?.[mutation]?.content;
      
      if (content) {
        await this.injector.injectContent(content);
        promptInput.value = '';
      }
    } catch (error) {
      console.error('Error composing draft:', error);
    }
  }
  
  private async getUserToken(): Promise<string> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken);
      });
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UniversalComposerInjector().initialize();
  });
} else {
  new UniversalComposerInjector().initialize();
}
```

### 6.2 Gmail Draft Injector

**File:** `/extension/src/content-scripts/gmail-injector.ts`

```typescript
class GmailDraftInjector {
  private findComposeBox(): HTMLElement | null {
    return document.querySelector('div[role="textbox"][aria-label*="Message Body"]') ||
           document.querySelector('.Am.Al.editable') ||
           document.querySelector('div[g_editable="true"]');
  }
  
  async injectContent(draftContent: string): Promise<void> {
    const replyButton = document.querySelector('div[role="button"][aria-label*="Reply"]');
    if (replyButton) {
      (replyButton as HTMLElement).click();
      await this.waitForComposeBox();
    }
    
    const composeBox = this.findComposeBox();
    if (!composeBox) {
      throw new Error('Gmail compose box not found');
    }
    
    composeBox.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertHTML', false, draftContent);
    composeBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private async waitForComposeBox(timeout = 2000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.findComposeBox()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Compose box did not appear');
  }
}
```

### 6.3 Twitter Reply Injector

**File:** `/extension/src/content-scripts/twitter-injector.ts`

```typescript
class TwitterReplyInjector {
  private findComposeBox(): HTMLElement | null {
    return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
           document.querySelector('div[role="textbox"][data-focusable="true"]');
  }
  
  async injectContent(generatedContent: string): Promise<void> {
    const replyButton = document.querySelector('div[data-testid="reply"]');
    if (replyButton) {
      (replyButton as HTMLElement).click();
      await this.waitForComposeBox();
    }
    
    const composeBox = this.findComposeBox();
    if (!composeBox) throw new Error('Twitter compose box not found');
    
    composeBox.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, generatedContent);
    composeBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private async waitForComposeBox(timeout = 2000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.findComposeBox()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Compose box did not appear');
  }
}
```

---

## Summary: Implementation Checklist

### Backend (API)
- [ ] Remove old schemas (`email.schema.ts`, `email-embedding.schema.ts`)
- [ ] Create new unified schemas (Gmail, Notion, Twitter embeddings + sync states)
- [ ] Delete old services (`email-indexing.service.ts`, `email.service.ts`)
- [ ] Create `EmbeddingService` (OpenAI)
- [ ] Create `GmailIndexerService` with bulk + incremental sync
- [ ] Create `VectorSearchService` for cross-platform search
- [ ] Remove email listing queries from `email.resolver.ts`
- [ ] Create `IndexingResolver` with GraphQL queries/mutations
- [ ] Create `CompositionResolver` with GraphQL mutations for draft generation
- [ ] Create `IndexingModule` and `CompositionModule`
- [ ] Update `AppModule` to import new modules

### Frontend (Web)
- [ ] Delete `/web/app/emails/page.tsx`
- [ ] Delete `/web/app/emails/[messageId]/page.tsx`
- [ ] Update `/web/app/page.tsx` with multi-platform dashboard
- [ ] Create `/web/lib/graphql/indexing-queries.ts`
- [ ] Create `/web/lib/graphql/composition-queries.ts`

### Chrome Extension
- [ ] Create `/extension/src/content-scripts/universal-injector.ts`
- [ ] Create `/extension/src/content-scripts/gmail-injector.ts`
- [ ] Create `/extension/src/content-scripts/twitter-injector.ts`
- [ ] Update manifest.json to include content scripts

This unified plan uses **GraphQL exclusively**, removes all email listing UI, creates a **multi-platform indexing dashboard**, and establishes a scalable architecture for future platforms! 🚀
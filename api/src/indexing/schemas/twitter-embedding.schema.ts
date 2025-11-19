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


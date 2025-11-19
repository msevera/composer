import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GmailEmbeddingDocument = GmailEmbedding & Document;

@Schema({ timestamps: true })
export class GmailEmbedding {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  emailId: string;

  @Prop({ required: true })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ required: true })
  content: string;

  @Prop({ type: Object, required: true })
  metadata: {
    from: string;
    to: string[];
    subject: string;
    date: Date;
    threadId: string;
    labels: string[];
    snippet: string;
    position: string;
    hasAttachments: boolean;
  };

  @Prop()
  syncToken?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const GmailEmbeddingSchema = SchemaFactory.createForClass(GmailEmbedding);

GmailEmbeddingSchema.index({ userId: 1, emailId: 1, chunkIndex: 1 });
GmailEmbeddingSchema.index({ userId: 1, syncToken: 1 });
GmailEmbeddingSchema.index({ 'metadata.threadId': 1 });

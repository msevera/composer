import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailEmbeddingDocument = EmailEmbedding & Document;

@Schema({ timestamps: true })
export class EmailEmbedding {
  @Prop({ required: true, index: true })
  emailId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ default: 0 })
  chunkIndex: number;

  @Prop({ required: true })
  chunkText: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EmailEmbeddingSchema = SchemaFactory.createForClass(EmailEmbedding);

// Create compound index for efficient queries
EmailEmbeddingSchema.index({ userId: 1, emailId: 1, chunkIndex: 1 });


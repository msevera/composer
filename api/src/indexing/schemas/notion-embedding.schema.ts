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
    breadcrumb: string[];
    blockType: string;
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

NotionEmbeddingSchema.index({ userId: 1, pageId: 1 });
NotionEmbeddingSchema.index({ userId: 1, syncCursor: 1 });
NotionEmbeddingSchema.index({ 'metadata.lastEditedTime': -1 });

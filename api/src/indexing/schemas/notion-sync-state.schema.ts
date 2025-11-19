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

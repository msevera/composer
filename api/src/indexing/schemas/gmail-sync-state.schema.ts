import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GmailSyncStateDocument = GmailSyncState & Document;

@Schema({ timestamps: true })
export class GmailSyncState {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop()
  historyId?: string;

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

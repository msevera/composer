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


import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailDocument = Email & Document;

@Schema({ timestamps: true })
export class Email {
  @Prop({ required: true, unique: true })
  messageId: string;

  @Prop({ required: true, index: true })
  threadId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  from: string;

  @Prop({ type: [String], default: [] })
  to: string[];

  @Prop({ type: [String], default: [] })
  cc: string[];

  @Prop({ type: [String], default: [] })
  bcc: string[];

  @Prop()
  replyTo?: string;

  @Prop()
  snippet?: string;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: [String], default: [] })
  labels: string[];

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false })
  hasAttachments: boolean;

  @Prop({ default: 0 })
  attachmentCount: number;

  @Prop({ default: Date.now })
  indexedAt: Date;

  @Prop({ default: false })
  bodyFetched: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EmailSchema = SchemaFactory.createForClass(Email);


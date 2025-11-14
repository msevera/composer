import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VerificationDocument = Verification & Document;

@Schema({ timestamps: true })
export class Verification {
  @Prop({ required: true })
  identifier: string;

  @Prop({ required: true })
  value: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);


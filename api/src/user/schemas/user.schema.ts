import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  name?: string;

  @Prop()
  lastSignIn?: Date;

  @Prop()
  sendProductUpdates?: boolean;

  @Prop()
  onboardingCompleted?: boolean;

  @Prop()
  maxDraftsAllowed?: number;

  @Prop()
  draftsUsed?: number;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);


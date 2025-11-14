import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BetterAuthUserDocument = BetterAuthUser & Document;

@Schema({ timestamps: true })
export class BetterAuthUser {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;

  @Prop({ required: true, default: false })
  emailVerified: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const BetterAuthUserSchema = SchemaFactory.createForClass(BetterAuthUser);


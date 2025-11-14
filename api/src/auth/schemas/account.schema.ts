import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountDocument = Account & Document;

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  accountId: string;

  @Prop({ required: true })
  providerId: string;

  @Prop()
  accessToken?: string;

  @Prop()
  refreshToken?: string;

  @Prop()
  idToken?: string;

  @Prop()
  expiresAt?: Date;

  @Prop()
  password?: string;
}

export const AccountSchema = SchemaFactory.createForClass(Account);


import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Email {
  @Field(() => ID)
  id: string;

  @Field()
  messageId: string;

  @Field()
  threadId: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  subject?: string;

  @Field()
  from: string;

  @Field(() => [String])
  to: string[];

  @Field(() => [String])
  cc: string[];

  @Field(() => [String])
  bcc: string[];

  @Field({ nullable: true })
  replyTo?: string;

  @Field({ nullable: true })
  snippet?: string;

  @Field()
  date: Date;

  @Field(() => [String])
  labels: string[];

  @Field()
  isRead: boolean;

  @Field()
  hasAttachments: boolean;

  @Field(() => Int)
  attachmentCount: number;

  @Field()
  indexedAt: Date;

  @Field()
  bodyFetched: boolean;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;
}


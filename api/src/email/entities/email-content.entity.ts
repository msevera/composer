import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class EmailAttachment {
  @Field()
  attachmentId: string;

  @Field()
  filename: string;

  @Field()
  mimeType: string;

  @Field(() => Int)
  size: number;
}

@ObjectType()
export class EmailContent {
  @Field(() => ID)
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

  @Field()
  date: Date;

  @Field({ nullable: true })
  textBody?: string;

  @Field({ nullable: true })
  htmlBody?: string;

  @Field(() => [EmailAttachment])
  attachments: EmailAttachment[];

  @Field(() => [String])
  labels: string[];
}


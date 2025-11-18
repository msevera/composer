import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class EmailDraft {
  @Field(() => ID)
  id: string;

  @Field()
  threadId: string;

  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  subject?: string;

  @Field(() => [String])
  to: string[];

  @Field(() => [String])
  cc: string[];

  @Field(() => [String])
  bcc: string[];

  @Field({ nullable: true })
  body?: string;
}



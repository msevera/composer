import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateDraftInput {
  @Field()
  messageId: string;

  @Field()
  threadId: string;

  @Field(() => [String])
  to: string[];

  @Field(() => [String], { nullable: true })
  cc?: string[];

  @Field(() => [String], { nullable: true })
  bcc?: string[];

  @Field({ nullable: true })
  subject?: string;

  @Field()
  body: string;
}



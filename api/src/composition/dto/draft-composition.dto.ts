import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType()
export class DraftCompositionInput {
  @Field()
  prompt: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  conversationId?: string;

  @Field({ nullable: true })
  replyToId?: string;
}

@ObjectType()
export class DraftCompositionResult {
  @Field()
  content: string;

  @Field(() => [String])
  sources: string[];
}


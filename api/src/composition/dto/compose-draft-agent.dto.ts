import { Field, InputType, ObjectType } from '@nestjs/graphql';

@InputType()
export class ComposeDraftAgentInput {
  @Field()
  userPrompt: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  conversationId?: string;

  @Field({ nullable: true })
  accountId?: string;
}

@ObjectType()
export class ConversationMessage {
  @Field()
  role: string;

  @Field()
  content: string;

  @Field()
  kind: string;
}

@ObjectType()
export class ConversationState {
  @Field()
  conversationId: string;

  @Field()
  exists: boolean;

  @Field(() => [ConversationMessage], { nullable: true })
  messages?: ConversationMessage[];
}


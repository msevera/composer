import { Field, InputType, ObjectType, createUnionType } from '@nestjs/graphql';

@InputType()
export class ComposeDraftAgentInput {
  @Field()
  userPrompt: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  conversationId?: string;
}

@InputType()
export class ResumeDraftCompositionInput {
  @Field()
  conversationId: string;

  @Field()
  userResponse: string;
}

@ObjectType()
export class DraftResult {
  @Field()
  status: string;

  @Field()
  draftContent: string;

  @Field()
  conversationId: string;

  @Field(() => [String])
  activity: string[];
}

@ObjectType()
export class ClarificationRequired {
  @Field()
  status: string;

  @Field()
  question: string;

  @Field()
  conversationId: string;

  @Field(() => [String])
  activity: string[];
}

export const ComposeDraftAgentResponse = createUnionType({
  name: 'ComposeDraftAgentResponse',
  types: () => [DraftResult, ClarificationRequired] as const,
  resolveType: (value) => {
    if ('question' in value) {
      return ClarificationRequired;
    }
    return DraftResult;
  },
});



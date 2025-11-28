import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  lastSignIn?: Date;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  sendProductUpdates?: boolean;

  @Field({ nullable: true })
  onboardingCompleted?: boolean;

  @Field({ nullable: true })
  maxDraftsAllowed?: number;

  @Field({ nullable: true })
  draftsUsed?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}


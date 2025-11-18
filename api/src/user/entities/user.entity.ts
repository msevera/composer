import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  lastSignIn?: Date;

  @Field()
  isEmailIndexingInProgress: boolean;

  @Field({ nullable: true })
  emailIndexingStartedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}


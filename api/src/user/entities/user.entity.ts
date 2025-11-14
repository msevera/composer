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
  createdAt: Date;

  @Field()
  updatedAt: Date;
}


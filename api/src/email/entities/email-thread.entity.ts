import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Email } from './email.entity';

@ObjectType()
export class EmailThread {
  @Field()
  threadId: string;

  @Field()
  userId: string;

  @Field(() => [Email])
  emails: Email[];

  @Field(() => Int)
  emailCount: number;

  @Field({ nullable: true })
  subject?: string;

  @Field()
  lastEmailDate: Date;

  @Field()
  isRead: boolean;
}


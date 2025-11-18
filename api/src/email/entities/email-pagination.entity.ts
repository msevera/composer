import { ObjectType, Field } from '@nestjs/graphql';
import { Email } from './email.entity';
import { EmailThread } from './email-thread.entity';

@ObjectType()
export class EmailPagination {
  @Field(() => [Email])
  emails: Email[];

  @Field({ nullable: true })
  nextCursor?: string;

  @Field({ nullable: true })
  prevCursor?: string;

  @Field()
  hasNext: boolean;

  @Field()
  hasPrev: boolean;
}

@ObjectType()
export class EmailThreadPagination {
  @Field(() => [EmailThread])
  threads: EmailThread[];

  @Field({ nullable: true })
  nextCursor?: string;

  @Field({ nullable: true })
  prevCursor?: string;

  @Field()
  hasNext: boolean;

  @Field()
  hasPrev: boolean;
}


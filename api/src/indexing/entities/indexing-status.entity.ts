import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PlatformIndexingStatus {
  @Field()
  platform: string;

  @Field()
  status: string;

  @Field()
  totalIndexed: number;

  @Field({ nullable: true })
  lastSyncedAt?: Date;

  @Field({ nullable: true })
  errorMessage?: string;
}

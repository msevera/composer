import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PlatformIndexingStatus {
  @Field()
  platform: string; // 'gmail' | 'notion' | 'twitter'

  @Field()
  status: string; // 'idle' | 'syncing' | 'completed' | 'error'

  @Field()
  totalIndexed: number;

  @Field({ nullable: true })
  lastSyncedAt?: Date;

  @Field({ nullable: true })
  errorMessage?: string;
}

@ObjectType()
export class IndexingStatus {
  @Field(() => [PlatformIndexingStatus])
  platforms: PlatformIndexingStatus[];
}


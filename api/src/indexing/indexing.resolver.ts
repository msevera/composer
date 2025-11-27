import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { PlatformIndexingStatus } from './entities/indexing-status.entity';

@Resolver()
export class IndexingResolver {
  constructor() {}

  /**
   * Get indexing status for specific platform
   */
  @Query(() => PlatformIndexingStatus)
  async getIndexingStatus(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<PlatformIndexingStatus> {
    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Get indexing status for all platforms
   */
  @Query(() => [PlatformIndexingStatus])
  async getAllIndexingStatuses(@Context() context: any): Promise<PlatformIndexingStatus[]> {
    return [];
  }

  /**
   * Start indexing for specific platform
   */
  @Mutation(() => String)
  async startIndexing(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Trigger manual sync for specific platform
   */
  @Mutation(() => String)
  async triggerSync(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    throw new Error(`Platform '${platform}' not supported`);
  }
}

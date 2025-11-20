import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { NotionIndexerService } from './services/notion-indexer.service';
import { PlatformIndexingStatus } from './entities/indexing-status.entity';
import { NotionService } from '../notion/notion.service';
import { Session, UserSession, AllowAnonymous, OptionalAuth } from '@thallesp/nestjs-better-auth';

@Resolver()
export class IndexingResolver {
  constructor(
    private notionIndexerService: NotionIndexerService,
    private notionService: NotionService,
  ) {}

  /**
   * Get indexing status for specific platform
   */
  @Query(() => PlatformIndexingStatus)
  async getIndexingStatus(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<PlatformIndexingStatus> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform !== 'notion') {
      throw new Error(`Platform '${platform}' not supported`);
    }

    const isConnected = await this.notionService.isNotionConnected(userId.toString());
    if (!isConnected) {
      throw new Error('Notion account not connected');
    }

    const syncState = await this.notionIndexerService.getSyncStatus(userId.toString());
    return {
      platform: 'notion',
      status: syncState?.status || 'idle',
      totalIndexed: syncState?.totalPagesIndexed || 0,
      lastSyncedAt: syncState?.lastSyncedAt,
      errorMessage: syncState?.errorMessage,
    };
  }

  /**
   * Get indexing status for all platforms
   */
  @Query(() => [PlatformIndexingStatus])
  async getAllIndexingStatuses(@Context() context: any): Promise<PlatformIndexingStatus[]> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    const statuses: PlatformIndexingStatus[] = [];

    const notionConnected = await this.notionService.isNotionConnected(userId.toString());
    if (notionConnected) {
      const notionStatus = await this.notionIndexerService.getSyncStatus(userId.toString());
      statuses.push({
        platform: 'notion',
        status: notionStatus?.status || 'idle',
        totalIndexed: notionStatus?.totalPagesIndexed || 0,
        lastSyncedAt: notionStatus?.lastSyncedAt,
        errorMessage: notionStatus?.errorMessage,
      });
    }

    return statuses;
  }

  /**
   * Start indexing for specific platform
   */
  @Mutation(() => String)
  async startIndexing(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {

    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform !== 'notion') {
      throw new Error(`Platform '${platform}' not supported`);
    }

    const notionConnected = await this.notionService.isNotionConnected(userId.toString());
    if (!notionConnected) {
      throw new Error('Notion not connected');
    }

    const syncState = await this.notionIndexerService.getSyncStatus(userId.toString());
    if (syncState?.status === 'syncing') {
      return 'Notion indexing already in progress';
    }

    this.notionIndexerService
      .indexUserNotion(userId.toString())
      .catch((error) => {
        console.error('Notion indexing error:', error);
      });

    return 'Notion indexing started';
  }

  /**
   * Trigger manual sync for specific platform
   */
  @Mutation(() => String)
  async triggerSync(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform !== 'notion') {
      throw new Error(`Platform '${platform}' not supported`);
    }

    const notionConnected = await this.notionService.isNotionConnected(userId.toString());
    if (!notionConnected) {
      throw new Error('Notion not connected');
    }

    await this.notionIndexerService.incrementalSync(userId.toString());
    return 'Notion sync completed';
  }
}

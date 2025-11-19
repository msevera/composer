import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { PlatformIndexingStatus } from './entities/indexing-status.entity';

@Resolver()
export class IndexingResolver {
  constructor(
    private gmailIndexerService: GmailIndexerService,
    // Add other indexers when ready: NotionIndexerService, TwitterIndexerService
  ) {}

  /**
   * Get indexing status for specific platform
   */
  @Query(() => PlatformIndexingStatus)
  @UseGuards(AuthGuard)
  async getIndexingStatus(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<PlatformIndexingStatus> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      
      return {
        platform: 'gmail',
        status: syncState?.status || 'idle',
        totalIndexed: syncState?.totalEmailsIndexed || 0,
        lastSyncedAt: syncState?.lastSyncedAt,
        errorMessage: syncState?.errorMessage,
      };
    }

    // Add support for 'notion' and 'twitter' later
    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Get indexing status for all platforms
   */
  @Query(() => [PlatformIndexingStatus])
  @UseGuards(AuthGuard)
  async getAllIndexingStatuses(@Context() context: any): Promise<PlatformIndexingStatus[]> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    const gmailStatus = await this.gmailIndexerService.getSyncStatus(userId.toString());

    return [
      {
        platform: 'gmail',
        status: gmailStatus?.status || 'idle',
        totalIndexed: gmailStatus?.totalEmailsIndexed || 0,
        lastSyncedAt: gmailStatus?.lastSyncedAt,
        errorMessage: gmailStatus?.errorMessage,
      },
      // Add Notion and Twitter when ready
    ];
  }

  /**
   * Start indexing for specific platform
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async startIndexing(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      // Check if already indexing
      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      if (syncState?.status === 'syncing') {
        return 'Gmail indexing already in progress';
      }

      // Start indexing (background job)
      this.gmailIndexerService.indexUserEmails(userId.toString()).catch((error) => {
        console.error('Gmail indexing error:', error);
      });

      return 'Gmail indexing started';
    }

    throw new Error(`Platform '${platform}' not supported`);
  }

  /**
   * Trigger manual sync for specific platform
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async triggerSync(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      await this.gmailIndexerService.incrementalSync(userId.toString());
      return 'Gmail sync completed';
    }

    throw new Error(`Platform '${platform}' not supported`);
  }
}


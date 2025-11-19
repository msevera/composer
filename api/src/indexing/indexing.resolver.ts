import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { NotionIndexerService } from './services/notion-indexer.service';
import { PlatformIndexingStatus } from './entities/indexing-status.entity';
import { GmailService } from '../gmail/gmail.service';
import { NotionService } from '../notion/notion.service';

@Resolver()
export class IndexingResolver {
  constructor(
    private gmailIndexerService: GmailIndexerService,
    private notionIndexerService: NotionIndexerService,
    private gmailService: GmailService,
    private notionService: NotionService,
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
      const isConnected = await this.gmailService.isGmailConnected(userId.toString());
      if (!isConnected) {
        throw new Error('Gmail account not connected');
      }

      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      return {
        platform: 'gmail',
        status: syncState?.status || 'idle',
        totalIndexed: syncState?.totalEmailsIndexed || 0,
        lastSyncedAt: syncState?.lastSyncedAt,
        errorMessage: syncState?.errorMessage,
      };
    }

    if (platform === 'notion') {
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

    const statuses: PlatformIndexingStatus[] = [];

    const gmailConnected = await this.gmailService.isGmailConnected(userId.toString());
    if (gmailConnected) {
      const gmailStatus = await this.gmailIndexerService.getSyncStatus(userId.toString());
      statuses.push({
        platform: 'gmail',
        status: gmailStatus?.status || 'idle',
        totalIndexed: gmailStatus?.totalEmailsIndexed || 0,
        lastSyncedAt: gmailStatus?.lastSyncedAt,
        errorMessage: gmailStatus?.errorMessage,
      });
    }

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
  @UseGuards(AuthGuard)
  async startIndexing(
    @Context() context: any,
    @Args('platform') platform: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    if (platform === 'gmail') {
      const isConnected = await this.gmailService.isGmailConnected(userId.toString());
      if (!isConnected) {
        throw new Error('Connect Gmail before starting indexing');
      }

      const syncState = await this.gmailIndexerService.getSyncStatus(userId.toString());
      if (syncState?.status === 'syncing') {
        return 'Gmail indexing already in progress';
      }

      this.gmailIndexerService.indexUserEmails(userId.toString()).catch((error) => {
        console.error('Gmail indexing error:', error);
      });

      return 'Gmail indexing started';
    }

    if (platform === 'notion') {
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
      const isConnected = await this.gmailService.isGmailConnected(userId.toString());
      if (!isConnected) {
        throw new Error('Gmail account not connected');
      }
      await this.gmailIndexerService.incrementalSync(userId.toString());
      return 'Gmail sync completed';
    }

    if (platform === 'notion') {
      const notionConnected = await this.notionService.isNotionConnected(userId.toString());
      if (!notionConnected) {
        throw new Error('Notion not connected');
      }

      await this.notionIndexerService.incrementalSync(userId.toString());
      return 'Notion sync completed';
    }

    throw new Error(`Platform '${platform}' not supported`);
  }
}

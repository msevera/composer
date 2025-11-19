import { Resolver, Query, Mutation, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotionService } from './notion.service';

@Resolver()
export class NotionResolver {
  constructor(private notionService: NotionService) {}

  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async isNotionConnected(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      return false;
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      return false;
    }

    try {
      const account = await this.notionService.getNotionAccount(userId.toString());
      return !!account;
    } catch (error) {
      console.error('Error checking Notion connection:', error);
      return false;
    }
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async disconnectNotion(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    try {
      const disconnected = await this.notionService.disconnectNotion(userId.toString());
      return disconnected;
    } catch (error) {
      console.error('Error disconnecting Notion:', error);
      throw new Error('Failed to disconnect Notion account');
    }
  }
}


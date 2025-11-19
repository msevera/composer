import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ObjectId } from 'mongodb';

@Injectable()
export class NotionService {
  private notionClients: Map<string, { token: string; client: Client }> = new Map();

  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
  ) {}

  /**
   * Get or create Notion client for user
   */
  private async getClient(userId: string): Promise<Client> {
    const accessToken = await this.getAccessToken(userId);
    const existing = this.notionClients.get(userId);

    if (!existing || existing.token !== accessToken) {
      const client = new Client({ auth: accessToken });
      this.notionClients.set(userId, { token: accessToken, client });
      return client;
    }

    return existing.client;
  }

  /**
   * Search for all pages
   */
  async searchPages(userId: string, cursor?: string) {
    const client = await this.getClient(userId);

    return await client.search({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      start_cursor: cursor,
      page_size: 100,
    });
  }

  /**
   * Get page details
   */
  async getPage(userId: string, pageId: string) {
    const client = await this.getClient(userId);
    return await client.pages.retrieve({ page_id: pageId });
  }

  /**
   * Get blocks (content) of a page
   */
  private async getBlocks(client: Client, blockId: string) {
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
    });
    return response.results;
  }

  /**
   * Recursively get all blocks (including nested)
   */
  async getAllBlocks(userId: string, blockId: string): Promise<any[]> {
    const client = await this.getClient(userId);
    return this.collectAllBlocks(client, blockId);
  }

  private async collectAllBlocks(client: Client, blockId: string): Promise<any[]> {
    const blocks = await this.getBlocks(client, blockId);
    const allBlocks: any[] = [];

    for (const block of blocks) {
      allBlocks.push(block);

      // If block has children, recursively fetch them
      if ((block as any).has_children) {
        const children = await this.collectAllBlocks(client, block.id);
        allBlocks.push(...children);
      }
    }

    return allBlocks;
  }

  /**
   * Extract text content from a block
   */
  extractBlockText(block: any): string {
    const blockType = block.type;
    
    if (!blockType || !block[blockType]) {
      return '';
    }

    const blockData = block[blockType];

    // Handle rich text arrays
    if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
      return blockData.rich_text.map((rt: any) => rt.plain_text || '').join('');
    }

    // Handle specific block types
    switch (blockType) {
      case 'paragraph':
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
      case 'bulleted_list_item':
      case 'numbered_list_item':
      case 'to_do':
      case 'toggle':
      case 'quote':
      case 'callout':
        return blockData.rich_text?.map((rt: any) => rt.plain_text || '').join('') || '';
      
      case 'code':
        return blockData.rich_text?.map((rt: any) => rt.plain_text || '').join('') || '';
      
      default:
        return '';
    }
  }

  /**
   * Account helpers
   */
  async getNotionAccount(userId: string): Promise<Record<string, any> | null> {
    const db = this.connection.db;

    let account = await db.collection('accounts').findOne({
      userId: userId.toString(),
      providerId: 'notion',
    });

    if (!account && ObjectId.isValid(userId)) {
      account = await db.collection('accounts').findOne({
        userId: new ObjectId(userId),
        providerId: 'notion',
      });
    }

    if (!account) {
      account = await db.collection('accounts').findOne({
        userId: userId.toString(),
        provider: 'notion',
      });
    }

    return account;
  }

  async isNotionConnected(userId: string): Promise<boolean> {
    const account = await this.getNotionAccount(userId);
    return !!account;
  }

  async getAccessToken(userId: string): Promise<string> {
    const account = await this.getNotionAccount(userId);
    if (!account) {
      throw new Error('Notion account not connected');
    }

    const accessToken = account.accessToken || account.access_token;
    if (!accessToken) {
      throw new Error('Notion access token not found');
    }

    return accessToken;
  }

  async disconnectNotion(userId: string): Promise<boolean> {
    const db = this.connection.db;

    const userIdString = userId.toString();
    const queries: Record<string, any>[] = [
      { userId: userIdString, providerId: 'notion' },
      { userId: userIdString, provider: 'notion' },
    ];

    if (ObjectId.isValid(userIdString)) {
      const objectId = new ObjectId(userIdString);
      queries.push({ userId: objectId, providerId: 'notion' });
      queries.push({ userId: objectId, provider: 'notion' });
    }

    for (const filter of queries) {
      const result = await db.collection('accounts').deleteOne(filter);
      if (result.deletedCount > 0) {
        return true;
      }
    }

    return false;
  }
}

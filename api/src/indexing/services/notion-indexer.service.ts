import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionEmbedding, NotionEmbeddingDocument } from '../schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateDocument } from '../schemas/notion-sync-state.schema';
import { EmbeddingService } from './embedding.service';
import { NotionService } from '../../notion/notion.service';

@Injectable()
export class NotionIndexerService {
  constructor(
    @InjectModel(NotionEmbedding.name) private embeddingModel: Model<NotionEmbeddingDocument>,
    @InjectModel(NotionSyncState.name) private syncStateModel: Model<NotionSyncStateDocument>,
    private embeddingService: EmbeddingService,
    private notionService: NotionService,
  ) {}

  /**
   * Initial bulk indexing of Notion pages
   */
  async indexUserNotion(userId: string): Promise<{ indexed: number; errors: number }> {
    // Update sync state to 'syncing'
    await this.syncStateModel.findOneAndUpdate(
      { userId },
      { status: 'syncing', errorMessage: null },
      { upsert: true }
    );

    try {
      let indexed = 0;
      let errors = 0;
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await this.notionService.searchPages(userId, cursor);
        
        if (!response.results || response.results.length === 0) {
          break;
        }

        // Process each page
        for (const page of response.results) {
          if (!this.isPageObject(page)) {
            continue;
          }
          try {
            await this.indexPage(userId, page);
            indexed++;
          } catch (error) {
            console.error(`Error indexing page ${page.id}:`, error);
            errors++;
          }
        }

        hasMore = response.has_more;
        cursor = response.next_cursor || undefined;
      }

      // Update sync state
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        {
          status: 'completed',
          lastSyncedAt: new Date(),
          totalPagesIndexed: indexed,
        }
      );

      return { indexed, errors };
    } catch (error) {
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { status: 'error', errorMessage: error.message }
      );
      throw error;
    }
  }

  /**
   * Index a single Notion page with block-boundary chunking
   */
  private async indexPage(userId: string, page: PageObjectResponse): Promise<void> {
    const pageId = page.id;

    // Check if already indexed
    const existing = await this.embeddingModel.findOne({ userId, pageId });
    if (existing) {
      return;
    }

    // Get page title
    const pageTitle = this.extractPageTitle(page);

    // Get all blocks (content)
    const blocks = await this.notionService.getAllBlocks(userId, pageId);

    if (blocks.length === 0) {
      console.log(`No blocks found for page ${pageId}`);
      return;
    }

    // Extract breadcrumb (simplified - just page title for now)
    const breadcrumb = [pageTitle];

    // Chunk blocks using block-boundary strategy
    const chunks = this.chunkBlocks(blocks);

    if (chunks.length === 0) {
      console.log(`No text content in page ${pageId}`);
      return;
    }

    // Generate embeddings in batch
    const embeddings = await this.embeddingService.batchGenerateEmbeddings(
      chunks.map(c => c.content)
    );

    // Store embeddings
    const workspaceId = this.getWorkspaceId(page);

    const embeddingDocs = chunks.map((chunk, index) => ({
      userId,
      pageId,
      blockId: chunk.blockId,
      chunkIndex: index,
      embedding: embeddings[index],
      content: chunk.content,
      metadata: {
        pageTitle,
        workspaceId,
        breadcrumb,
        blockType: chunk.blockType,
        hasChildren: chunk.hasChildren,
        createdTime: new Date(page.created_time),
        lastEditedTime: new Date(page.last_edited_time),
      },
    }));

    await this.embeddingModel.insertMany(embeddingDocs);
  }

  /**
   * Block-boundary chunking strategy
   */
  private chunkBlocks(blocks: any[]): Array<{
    blockId: string;
    content: string;
    blockType: string;
    hasChildren: boolean;
  }> {
    const chunks: Array<{
      blockId: string;
      content: string;
      blockType: string;
      hasChildren: boolean;
    }> = [];

    let currentChunk = '';
    let currentBlockIds: string[] = [];
    let currentBlockType = '';
    let hasChildren = false;

    for (const block of blocks) {
      const text = this.notionService.extractBlockText(block);
      
      if (!text || text.trim().length === 0) {
        continue; // Skip empty blocks
      }

      const blockType = block.type;

      // Strategy: Single-block chunks for blocks < 2000 chars
      if (text.length < 2000) {
        if (currentChunk.length === 0) {
          // Start new chunk
          currentChunk = text;
          currentBlockIds = [block.id];
          currentBlockType = blockType;
          hasChildren = block.has_children || false;
        } else if (currentChunk.length + text.length + 2 < 2000) {
          // Aggregate with current chunk
          currentChunk += '\n\n' + text;
          currentBlockIds.push(block.id);
        } else {
          // Save current chunk and start new one
          chunks.push({
            blockId: currentBlockIds[0],
            content: currentChunk,
            blockType: currentBlockType,
            hasChildren,
          });
          currentChunk = text;
          currentBlockIds = [block.id];
          currentBlockType = blockType;
          hasChildren = block.has_children || false;
        }
      } else {
        // Large block: Split at sentence boundaries
        if (currentChunk.length > 0) {
          chunks.push({
            blockId: currentBlockIds[0],
            content: currentChunk,
            blockType: currentBlockType,
            hasChildren,
          });
          currentChunk = '';
          currentBlockIds = [];
        }

        const sentences = text.split(/[.!?]+\s+/);
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 < 2000) {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
          } else {
            if (sentenceChunk) {
              chunks.push({
                blockId: block.id,
                content: sentenceChunk,
                blockType,
                hasChildren: block.has_children || false,
              });
            }
            sentenceChunk = sentence;
          }
        }

        if (sentenceChunk) {
          chunks.push({
            blockId: block.id,
            content: sentenceChunk,
            blockType,
            hasChildren: block.has_children || false,
          });
        }
      }
    }

    // Save remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        blockId: currentBlockIds[0],
        content: currentChunk,
        blockType: currentBlockType,
        hasChildren,
      });
    }

    return chunks;
  }

  /**
   * Extract page title from page object
   */
  private extractPageTitle(page: PageObjectResponse): string {
    const propertyEntries = Object.values(page.properties || {});
    for (const prop of propertyEntries) {
      if (prop?.type === 'title') {
        return prop.title?.map((t) => t.plain_text || '').join('') || 'Untitled';
      }
    }
    return 'Untitled';
  }

  /**
   * Incremental sync (poll for updated pages)
   */
  async incrementalSync(userId: string): Promise<void> {
    const syncState = await this.syncStateModel.findOne({ userId });
    if (!syncState?.lastSyncedAt) {
      console.log('No previous sync found, skipping incremental sync');
      return;
    }

    const lastSynced = syncState.lastSyncedAt;

    try {
      // Search for pages edited since last sync
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await this.notionService.searchPages(userId, cursor);
        
        for (const page of response.results) {
          if (!this.isPageObject(page)) {
            continue;
          }
          const lastEditedTime = new Date(page.last_edited_time);
          
          if (lastEditedTime > lastSynced) {
            // Delete old embeddings
            await this.embeddingModel.deleteMany({ userId, pageId: page.id });
            
            // Re-index
            await this.indexPage(userId, page);
          }
        }

        hasMore = response.has_more;
        cursor = response.next_cursor || undefined;
      }

      // Update last synced time
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { lastSyncedAt: new Date() }
      );
    } catch (error) {
      console.error('Error in Notion incremental sync:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<NotionSyncStateDocument | null> {
    return this.syncStateModel.findOne({ userId });
  }

  private getWorkspaceId(page: PageObjectResponse): string {
    const parent = page.parent;
    if (!parent) return '';

    if (parent.type === 'workspace') {
      return 'workspace';
    }

    if (parent.type === 'page_id') {
      return parent.page_id || '';
    }

    if (parent.type === 'database_id') {
      return parent.database_id || '';
    }

    if (parent.type === 'block_id') {
      return parent.block_id || '';
    }

    return '';
  }

  private isPageObject(page: any): page is PageObjectResponse {
    return page?.object === 'page' && 'id' in page && 'last_edited_time' in page;
  }
}

# Notion Integration Implementation Plan

This plan adds Notion OAuth authentication and indexing to the existing Smail application, following the same pattern as Gmail integration.

---

## Overview

Add Notion workspace integration that allows users to:
1. **Authenticate** with Notion OAuth
2. **Index** Notion pages and blocks with embeddings
3. **Search** Notion content via vector search for RAG-powered email composition

---

## Phase 1: Notion OAuth Setup

### 1.1 Create Notion OAuth Application

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Fill in details:
   - **Name**: Smail
   - **Logo**: (optional)
   - **Associated workspace**: Your workspace
   - **Capabilities**: Read content
4. Get credentials:
   - **Integration Token** (Internal Integration)
   - OR **OAuth Client ID + Secret** (Public Integration - recommended)

### 1.2 Environment Variables

Add to `/api/.env`:

```env
# Notion OAuth
NOTION_CLIENT_ID=your_notion_oauth_client_id
NOTION_CLIENT_SECRET=your_notion_oauth_client_secret
NOTION_REDIRECT_URI=http://localhost:3000/notion/callback
```

### 1.3 Install Notion SDK

```bash
cd api
npm install @notionhq/client
```

---

## Phase 2: Backend - Notion Service

### 2.1 Create Notion Service

**File:** `/api/src/notion/notion.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';

@Injectable()
export class NotionService {
  private notionClients: Map<string, Client> = new Map();

  constructor(private configService: ConfigService) {}

  /**
   * Get or create Notion client for user
   */
  getClient(userId: string, accessToken: string): Client {
    const key = `${userId}-${accessToken}`;
    if (!this.notionClients.has(key)) {
      this.notionClients.set(key, new Client({ auth: accessToken }));
    }
    return this.notionClients.get(key)!;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    workspaceId: string;
    workspaceName: string;
    botId: string;
  }> {
    const clientId = this.configService.get('NOTION_CLIENT_ID');
    const clientSecret = this.configService.get('NOTION_CLIENT_SECRET');
    const redirectUri = this.configService.get('NOTION_REDIRECT_URI');

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Notion OAuth error: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      botId: data.bot_id,
    };
  }

  /**
   * Search for all pages
   */
  async searchPages(userId: string, accessToken: string, cursor?: string) {
    const client = this.getClient(userId, accessToken);
    
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
  async getPage(userId: string, accessToken: string, pageId: string) {
    const client = this.getClient(userId, accessToken);
    return await client.pages.retrieve({ page_id: pageId });
  }

  /**
   * Get blocks (content) of a page
   */
  async getBlocks(userId: string, accessToken: string, blockId: string) {
    const client = this.getClient(userId, accessToken);
    
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
    });

    return response.results;
  }

  /**
   * Recursively get all blocks (including nested)
   */
  async getAllBlocks(
    userId: string,
    accessToken: string,
    blockId: string,
  ): Promise<any[]> {
    const blocks = await this.getBlocks(userId, accessToken, blockId);
    const allBlocks: any[] = [];

    for (const block of blocks) {
      allBlocks.push(block);

      // If block has children, recursively fetch them
      if ((block as any).has_children) {
        const children = await this.getAllBlocks(userId, accessToken, block.id);
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
}
```

---

## Phase 3: Backend - User Schema Update

### 3.1 Update User Schema

**Update:** `/api/src/user/schemas/user.schema.ts`

Add Notion authentication fields:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  // ... existing fields ...

  @Prop({ type: Object })
  notionAuth?: {
    accessToken: string;
    workspaceId: string;
    workspaceName: string;
    botId: string;
    connectedAt: Date;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

---

## Phase 4: Backend - Notion Resolver

### 4.1 Create Notion Resolver

**File:** `/api/src/notion/notion.resolver.ts`

```typescript
import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotionService } from './notion.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/schemas/user.schema';

@Resolver()
export class NotionResolver {
  constructor(
    private notionService: NotionService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Handle Notion OAuth callback
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async connectNotion(
    @Context() context: any,
    @Args('code') code: string,
  ): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    try {
      // Exchange code for access token
      const tokenData = await this.notionService.exchangeCodeForToken(code);

      // Store in user document
      await this.userModel.findByIdAndUpdate(userId, {
        notionAuth: {
          accessToken: tokenData.accessToken,
          workspaceId: tokenData.workspaceId,
          workspaceName: tokenData.workspaceName,
          botId: tokenData.botId,
          connectedAt: new Date(),
        },
      });

      return `Notion workspace "${tokenData.workspaceName}" connected successfully`;
    } catch (error) {
      console.error('Error connecting Notion:', error);
      throw new Error(`Failed to connect Notion: ${error.message}`);
    }
  }

  /**
   * Check if Notion is connected
   */
  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async isNotionConnected(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    const userDoc = await this.userModel.findById(userId);
    return Boolean(userDoc?.notionAuth?.accessToken);
  }

  /**
   * Get Notion workspace info
   */
  @Query(() => String, { nullable: true })
  @UseGuards(AuthGuard)
  async getNotionWorkspaceName(@Context() context: any): Promise<string | null> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    const userDoc = await this.userModel.findById(userId);
    return userDoc?.notionAuth?.workspaceName || null;
  }

  /**
   * Disconnect Notion
   */
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async disconnectNotion(@Context() context: any): Promise<string> {
    const user = context.req.user;
    const userId = user.id || user.userId || user._id;

    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { notionAuth: 1 },
    });

    return 'Notion workspace disconnected successfully';
  }
}
```

### 4.2 Create Notion Module

**File:** `/api/src/notion/notion.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotionService } from './notion.service';
import { NotionResolver } from './notion.resolver';
import { User, UserSchema } from '../user/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [NotionService, NotionResolver],
  exports: [NotionService],
})
export class NotionModule {}
```

---

## Phase 5: Backend - Notion Indexer Service

### 5.1 Create Notion Indexer Service

**File:** `/api/src/indexing/services/notion-indexer.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotionEmbedding, NotionEmbeddingDocument } from '../schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateDocument } from '../schemas/notion-sync-state.schema';
import { EmbeddingService } from './embedding.service';
import { NotionService } from '../../notion/notion.service';
import { User, UserDocument } from '../../user/schemas/user.schema';

@Injectable()
export class NotionIndexerService {
  constructor(
    @InjectModel(NotionEmbedding.name) private embeddingModel: Model<NotionEmbeddingDocument>,
    @InjectModel(NotionSyncState.name) private syncStateModel: Model<NotionSyncStateDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private embeddingService: EmbeddingService,
    private notionService: NotionService,
  ) {}

  /**
   * Initial bulk indexing of Notion pages
   */
  async indexUserNotion(userId: string): Promise<{ indexed: number; errors: number }> {
    // Get user's Notion access token
    const user = await this.userModel.findById(userId);
    if (!user?.notionAuth?.accessToken) {
      throw new Error('Notion not connected');
    }

    const accessToken = user.notionAuth.accessToken;

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
        const response = await this.notionService.searchPages(userId, accessToken, cursor);
        
        if (!response.results || response.results.length === 0) {
          break;
        }

        // Process each page
        for (const page of response.results) {
          try {
            await this.indexPage(userId, accessToken, page);
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
  private async indexPage(userId: string, accessToken: string, page: any): Promise<void> {
    const pageId = page.id;

    // Check if already indexed
    const existing = await this.embeddingModel.findOne({ userId, pageId });
    if (existing) {
      return;
    }

    // Get page title
    const pageTitle = this.extractPageTitle(page);

    // Get all blocks (content)
    const blocks = await this.notionService.getAllBlocks(userId, accessToken, pageId);

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
    const embeddingDocs = chunks.map((chunk, index) => ({
      userId,
      pageId,
      blockId: chunk.blockId,
      chunkIndex: index,
      embedding: embeddings[index],
      content: chunk.content,
      metadata: {
        pageTitle,
        workspaceId: page.parent?.workspace ? 'workspace' : page.parent?.page_id || '',
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
  private extractPageTitle(page: any): string {
    if (page.properties?.title?.title) {
      return page.properties.title.title
        .map((t: any) => t.plain_text || '')
        .join('');
    }
    if (page.properties?.Name?.title) {
      return page.properties.Name.title
        .map((t: any) => t.plain_text || '')
        .join('');
    }
    return 'Untitled';
  }

  /**
   * Incremental sync (poll for updated pages)
   */
  async incrementalSync(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user?.notionAuth?.accessToken) {
      throw new Error('Notion not connected');
    }

    const syncState = await this.syncStateModel.findOne({ userId });
    if (!syncState?.lastSyncedAt) {
      console.log('No previous sync found, skipping incremental sync');
      return;
    }

    const accessToken = user.notionAuth.accessToken;
    const lastSynced = syncState.lastSyncedAt;

    try {
      // Search for pages edited since last sync
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await this.notionService.searchPages(userId, accessToken, cursor);
        
        for (const page of response.results) {
          const lastEditedTime = new Date(page.last_edited_time);
          
          if (lastEditedTime > lastSynced) {
            // Delete old embeddings
            await this.embeddingModel.deleteMany({ userId, pageId: page.id });
            
            // Re-index
            await this.indexPage(userId, accessToken, page);
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
}
```

---

## Phase 6: Frontend - Notion OAuth UI

### 6.1 Add Notion GraphQL Queries

**Create:** `/web/lib/graphql/notion-queries.ts`

```typescript
import { gql } from '@apollo/client';

export const IS_NOTION_CONNECTED = gql`
  query IsNotionConnected {
    isNotionConnected
  }
`;

export const GET_NOTION_WORKSPACE_NAME = gql`
  query GetNotionWorkspaceName {
    getNotionWorkspaceName
  }
`;

export const CONNECT_NOTION = gql`
  mutation ConnectNotion($code: String!) {
    connectNotion(code: $code)
  }
`;

export const DISCONNECT_NOTION = gql`
  mutation DisconnectNotion {
    disconnectNotion
  }
`;
```

### 6.2 Create Notion Callback Page

**Create:** `/web/app/notion/callback/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { CONNECT_NOTION } from '@/lib/graphql/notion-queries';
import { apolloClient } from '@/lib/apollo-client';

export default function NotionCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting Notion workspace...');

  const [connectNotion] = useMutation(CONNECT_NOTION, {
    client: apolloClient,
  });

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Error: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received');
      return;
    }

    // Exchange code for token
    connectNotion({ variables: { code } })
      .then((result) => {
        setStatus('success');
        setMessage(result.data?.connectNotion || 'Notion connected successfully!');
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(`Error connecting Notion: ${err.message}`);
      });
  }, [searchParams, connectNotion, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-lg text-slate-700">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">✓</div>
            <p className="text-lg text-emerald-700">{message}</p>
            <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">✗</div>
            <p className="text-lg text-red-700">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

### 6.3 Update Home Page with Notion Connect Button

**Update:** `/web/app/page.tsx`

Add Notion connection handling:

```typescript
// Add to imports
import { IS_NOTION_CONNECTED, DISCONNECT_NOTION } from '@/lib/graphql/notion-queries';

// Add state
const [isNotionConnected, setIsNotionConnected] = useState(false);

// Add query
const { data: notionData } = useQuery(IS_NOTION_CONNECTED, {
  client: apolloClient,
  skip: !isAuthenticated,
  pollInterval: 5000,
});

// Add mutation
const [disconnectNotion] = useMutation(DISCONNECT_NOTION, {
  client: apolloClient,
});

// Update effect
useEffect(() => {
  if (notionData?.isNotionConnected !== undefined) {
    setIsNotionConnected(notionData.isNotionConnected);
  }
}, [notionData]);

// Add handler
const handleConnectNotion = () => {
  const clientId = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID;
  const redirectUri = encodeURIComponent('http://localhost:3000/notion/callback');
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}`;
  
  window.location.href = authUrl;
};

const handleDisconnectNotion = async () => {
  try {
    await disconnectNotion();
    setIsNotionConnected(false);
    setMessage('Notion disconnected successfully');
  } catch (error: any) {
    setMessage(`Error: ${error.message}`);
  }
};
```

Replace the Notion "COMING SOON" card with:

```typescript
{/* Notion Status Card */}
{statuses.find((s) => s.platform === 'notion') ? (
  <div
    className={`rounded-xl border p-4 ${getStatusColor(
      statuses.find((s) => s.platform === 'notion')?.status || 'idle'
    )}`}
  >
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-semibold">Notion</h3>
      <span className="text-sm font-medium">
        {statuses.find((s) => s.platform === 'notion')?.status.toUpperCase()}
      </span>
    </div>

    <div className="space-y-2 text-sm">
      <div>
        <span className="font-medium">Pages Indexed:</span>{' '}
        {statuses.find((s) => s.platform === 'notion')?.totalIndexed || 0}
      </div>
      <div>
        <span className="font-medium">Last Synced:</span>{' '}
        {formatDate(statuses.find((s) => s.platform === 'notion')?.lastSyncedAt)}
      </div>
    </div>

    {statuses.find((s) => s.platform === 'notion')?.status !== 'syncing' && (
      <button
        onClick={() => handleStartIndexing('notion')}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        {statuses.find((s) => s.platform === 'notion')?.totalIndexed > 0
          ? 'Re-index'
          : 'Start Indexing'}
      </button>
    )}

    {statuses.find((s) => s.platform === 'notion')?.status === 'syncing' && (
      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm">Indexing in progress...</span>
      </div>
    )}

    <button
      onClick={handleDisconnectNotion}
      className="mt-2 w-full rounded-lg bg-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-300"
    >
      Disconnect
    </button>
  </div>
) : (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-semibold text-slate-600">Notion</h3>
      <span className="text-sm font-medium text-slate-500">
        {isNotionConnected ? 'CONNECTED' : 'NOT CONNECTED'}
      </span>
    </div>
    
    {!isNotionConnected ? (
      <>
        <p className="mb-3 text-sm text-slate-500">
          Connect your Notion workspace to index pages and databases.
        </p>
        <button
          onClick={handleConnectNotion}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Connect Notion
        </button>
      </>
    ) : (
      <>
        <p className="mb-3 text-sm text-emerald-600">
          Notion workspace connected! Click "Start Indexing" to begin.
        </p>
        <button
          onClick={handleDisconnectNotion}
          className="w-full rounded-lg bg-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-300"
        >
          Disconnect
        </button>
      </>
    )}
  </div>
)}
```

### 6.4 Add Environment Variable

**Create:** `/web/.env.local` (or update existing)

```env
NEXT_PUBLIC_NOTION_CLIENT_ID=your_notion_oauth_client_id
```

---

## Phase 7: Update Indexing Resolver

### 7.1 Update Indexing Resolver to Support Notion

**Update:** `/api/src/indexing/indexing.resolver.ts`

Add NotionIndexerService support:

```typescript
constructor(
  private gmailIndexerService: GmailIndexerService,
  private notionIndexerService: NotionIndexerService, // ADD THIS
) {}

// Update getIndexingStatus
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

  if (platform === 'notion') {
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

// Update getAllIndexingStatuses
@Query(() => [PlatformIndexingStatus])
@UseGuards(AuthGuard)
async getAllIndexingStatuses(@Context() context: any): Promise<PlatformIndexingStatus[]> {
  const user = context.req.user;
  const userId = user.id || user.userId || user._id;

  const gmailStatus = await this.gmailIndexerService.getSyncStatus(userId.toString());
  const notionStatus = await this.notionIndexerService.getSyncStatus(userId.toString());

  return [
    {
      platform: 'gmail',
      status: gmailStatus?.status || 'idle',
      totalIndexed: gmailStatus?.totalEmailsIndexed || 0,
      lastSyncedAt: gmailStatus?.lastSyncedAt,
      errorMessage: gmailStatus?.errorMessage,
    },
    {
      platform: 'notion',
      status: notionStatus?.status || 'idle',
      totalIndexed: notionStatus?.totalPagesIndexed || 0,
      lastSyncedAt: notionStatus?.lastSyncedAt,
      errorMessage: notionStatus?.errorMessage,
    },
  ];
}

// Update startIndexing
@Mutation(() => String)
@UseGuards(AuthGuard)
async startIndexing(
  @Context() context: any,
  @Args('platform') platform: string,
): Promise<string> {
  const user = context.req.user;
  const userId = user.id || user.userId || user._id;

  if (platform === 'gmail') {
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
    const syncState = await this.notionIndexerService.getSyncStatus(userId.toString());
    if (syncState?.status === 'syncing') {
      return 'Notion indexing already in progress';
    }

    this.notionIndexerService.indexUserNotion(userId.toString()).catch((error) => {
      console.error('Notion indexing error:', error);
    });

    return 'Notion indexing started';
  }

  throw new Error(`Platform '${platform}' not supported`);
}
```

---

## Phase 8: Update Modules

### 8.1 Update Indexing Module

**Update:** `/api/src/indexing/indexing.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GmailEmbedding, GmailEmbeddingSchema } from './schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateSchema } from './schemas/gmail-sync-state.schema';
import { NotionEmbedding, NotionEmbeddingSchema } from './schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateSchema } from './schemas/notion-sync-state.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { EmbeddingService } from './services/embedding.service';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { NotionIndexerService } from './services/notion-indexer.service';
import { IndexingResolver } from './indexing.resolver';
import { GmailModule } from '../gmail/gmail.module';
import { NotionModule } from '../notion/notion.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailEmbedding.name, schema: GmailEmbeddingSchema },
      { name: GmailSyncState.name, schema: GmailSyncStateSchema },
      { name: NotionEmbedding.name, schema: NotionEmbeddingSchema },
      { name: NotionSyncState.name, schema: NotionSyncStateSchema },
      { name: User.name, schema: UserSchema },
    ]),
    GmailModule,
    NotionModule,
  ],
  providers: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService,
  ],
})
export class IndexingModule {}
```

### 8.2 Update App Module

**Update:** `/api/src/app.module.ts`

```typescript
imports: [
  // ... existing imports
  NotionModule,
  IndexingModule,
]
```

---

## Testing Checklist

- [ ] Install `@notionhq/client` dependency
- [ ] Create Notion OAuth app and get credentials
- [ ] Add environment variables
- [ ] User can click "Connect Notion" button
- [ ] OAuth flow redirects to Notion and back
- [ ] Notion workspace is stored in user document
- [ ] User can click "Start Indexing" for Notion
- [ ] Notion pages are fetched and indexed
- [ ] Block-boundary chunking works correctly
- [ ] Embeddings are stored in `notion-embeddings` collection
- [ ] Sync status updates correctly during indexing
- [ ] User can disconnect Notion
- [ ] Dashboard shows Notion indexing status

---

## Next Steps After Notion Integration

1. Implement `VectorSearchService` to search across Gmail + Notion
2. Update `CompositionResolver` to include Notion in RAG context
3. Test email composition using both Gmail and Notion context
4. Add incremental sync scheduler (cron job every 15-30 min)

---

This plan follows the exact same pattern as Gmail integration for consistency!

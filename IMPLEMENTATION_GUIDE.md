# Multi-Platform Vector Store Implementation Guide

This guide provides step-by-step instructions to refactor the Smail application to support multi-platform indexing (Gmail, Notion, Twitter) using MongoDB Vector Store with GraphQL.

## Overview of Changes

### What's Being Removed:
- Old separate `emails` and `email-embeddings` collections
- Email listing UI pages (`/web/app/emails/`)
- Email listing GraphQL queries (`emails`, `emailThreads`, `emailContent`)
- Old `email-indexing.service.ts` and `email.service.ts`

### What's Being Added:
- Unified embedding schemas per platform (denormalized metadata)
- Multi-platform indexing services (Gmail, Notion, Twitter)
- Notion OAuth authentication
- Multi-platform dashboard UI
- Cross-platform vector search
- GraphQL-based composition endpoints

---

## Phase 1: Backend Schemas (COMPLETED ✓)

### Created Files:
- `/api/src/indexing/schemas/gmail-embedding.schema.ts`
- `/api/src/indexing/schemas/gmail-sync-state.schema.ts`
- `/api/src/indexing/schemas/notion-embedding.schema.ts`
- `/api/src/indexing/schemas/notion-sync-state.schema.ts`
- `/api/src/indexing/schemas/twitter-embedding.schema.ts` (TODO)
- `/api/src/indexing/schemas/twitter-sync-state.schema.ts` (TODO)

---

## Phase 2: Indexing Services

### 2.1 Embedding Service

**Create:** `/api/src/indexing/services/embedding.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    this.openai = new OpenAI({ apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch in chunks of 100
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      batches.push(texts.slice(i, i + 100));
    }

    const results: number[][] = [];
    for (const batch of batches) {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      results.push(...response.data.map(d => d.embedding));
    }
    return results;
  }
}
```

### 2.2 Gmail Indexer Service

**Create:** `/api/src/indexing/services/gmail-indexer.service.ts`

This service should:
- Index Gmail emails with embeddings (bulk initial + incremental sync)
- Use Gmail history API for incremental sync
- Store in `gmail-embeddings` collection with denormalized metadata
- Update `gmail-sync-state` with status

Key methods:
- `indexUserEmails(userId)` - Initial bulk indexing
- `incrementalSync(userId)` - Use historyId for changes
- `getSyncStatus(userId)` - Get current status

### 2.3 Notion Indexer Service

**Create:** `/api/src/indexing/services/notion-indexer.service.ts`

This service should:
- Index Notion pages with block-boundary chunking
- Fetch pages recursively (including child pages)
- Chunk by block type (respect Notion's structure)
- Store in `notion-embeddings` with breadcrumb metadata

Key methods:
- `indexUserNotion(userId)` - Initial bulk indexing
- `incrementalSync(userId)` - Poll for updated pages
- `getSyncStatus(userId)` - Get current status

**Block-Boundary Chunking Strategy:**
- Single blocks < 2000 chars: One chunk
- Multiple small blocks: Aggregate until 1500-2000 chars
- Large blocks > 2000 chars: Split at sentence boundaries with overlap
- Preserve hierarchy in metadata (breadcrumb)

---

## Phase 3: Notion OAuth Integration

### 3.1 Add Notion Service

**Create:** `/api/src/notion/notion.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';

@Injectable()
export class NotionService {
  private notionClients: Map<string, Client> = new Map();

  constructor(private configService: ConfigService) {}

  getClient(userId: string, accessToken: string): Client {
    if (!this.notionClients.has(userId)) {
      this.notionClients.set(userId, new Client({ auth: accessToken }));
    }
    return this.notionClients.get(userId)!;
  }

  async listPages(userId: string, accessToken: string) {
    const client = this.getClient(userId, accessToken);
    return await client.search({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    });
  }

  async getPage(userId: string, accessToken: string, pageId: string) {
    const client = this.getClient(userId, accessToken);
    return await client.pages.retrieve({ page_id: pageId });
  }

  async getBlocks(userId: string, accessToken: string, blockId: string) {
    const client = this.getClient(userId, accessToken);
    return await client.blocks.children.list({ block_id: blockId });
  }
}
```

### 3.2 Add Notion OAuth Schema

**Update:** `/api/src/user/schemas/user.schema.ts`

Add Notion credentials:

```typescript
@Prop({ type: Object })
notionAuth?: {
  accessToken: string;
  workspaceId: string;
  connectedAt: Date;
};
```

### 3.3 Add Notion Resolver

**Create:** `/api/src/notion/notion.resolver.ts`

```typescript
@Resolver()
export class NotionResolver {
  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async connectNotion(
    @Context() context: any,
    @Args('code') code: string,
  ): Promise<string> {
    // Exchange code for access token
    // Store in user.notionAuth
    // Return success message
  }

  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async isNotionConnected(@Context() context: any): Promise<boolean> {
    // Check if user has notionAuth
  }

  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async disconnectNotion(@Context() context: any): Promise<string> {
    // Remove user.notionAuth
  }
}
```

---

## Phase 4: Vector Search Service

**Create:** `/api/src/indexing/services/vector-search.service.ts`

This service should:
- Search across Gmail, Notion, Twitter embeddings
- Use MongoDB `$vectorSearch` aggregation
- Support source filtering and weighting
- Merge and re-rank results

Key method:
```typescript
async searchRelevantContext(
  userId: string,
  query: string,
  options: {
    sources?: ('gmail' | 'notion' | 'twitter')[];
    limit?: number;
    filters?: Record<string, any>;
    sourceWeights?: Record<string, number>;
  }
): Promise<SearchResult[]>
```

---

## Phase 5: GraphQL Resolvers

### 5.1 Indexing Resolver

**Create:** `/api/src/indexing/indexing.resolver.ts`

**Queries:**
- `getIndexingStatus(platform: String): PlatformIndexingStatus`
- `getAllIndexingStatuses(): [PlatformIndexingStatus]`

**Mutations:**
- `startIndexing(platform: String): String`
- `triggerSync(platform: String): String`

**Create Entity:** `/api/src/indexing/entities/indexing-status.entity.ts`

```typescript
@ObjectType()
export class PlatformIndexingStatus {
  @Field() platform: string;
  @Field() status: string;
  @Field() totalIndexed: number;
  @Field({ nullable: true }) lastSyncedAt?: Date;
  @Field({ nullable: true }) errorMessage?: string;
}
```

### 5.2 Composition Resolver

**Create:** `/api/src/composition/composition.resolver.ts`

**Mutations:**
- `composeDraft(input: DraftCompositionInput): DraftCompositionResult`
- `composeTweet(input: DraftCompositionInput): DraftCompositionResult`

Uses `VectorSearchService` + OpenAI GPT-4 for RAG-based generation.

---

## Phase 6: Frontend Updates

### 6.1 Create GraphQL Queries File

**Create:** `/web/lib/graphql/indexing-queries.ts`

```typescript
export const GET_ALL_INDEXING_STATUSES = gql`
  query GetAllIndexingStatuses {
    getAllIndexingStatuses {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

export const START_INDEXING = gql`
  mutation StartIndexing($platform: String!) {
    startIndexing(platform: $platform)
  }
`;
```

### 6.2 Delete Old Email Pages

**Remove:**
- `/web/app/emails/page.tsx`
- `/web/app/emails/[messageId]/page.tsx`

### 6.3 Update Home Page (ALREADY DONE ✓)

The home page has been updated with:
- Multi-platform dashboard UI
- Gmail/Notion/Twitter status cards
- "Start Indexing" buttons per platform

---

## Phase 7: Module Configuration

### 7.1 Indexing Module

**Create:** `/api/src/indexing/indexing.module.ts`

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailEmbedding.name, schema: GmailEmbeddingSchema },
      { name: GmailSyncState.name, schema: GmailSyncStateSchema },
      { name: NotionEmbedding.name, schema: NotionEmbeddingSchema },
      { name: NotionSyncState.name, schema: NotionSyncStateSchema },
      // Add Twitter schemas when ready
    ]),
    GmailModule,
  ],
  providers: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService, // When ready
    VectorSearchService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService,
    VectorSearchService,
  ],
})
export class IndexingModule {}
```

### 7.2 Notion Module

**Create:** `/api/src/notion/notion.module.ts`

```typescript
@Module({
  providers: [NotionService, NotionResolver],
  exports: [NotionService],
})
export class NotionModule {}
```

### 7.3 Composition Module

**Create:** `/api/src/composition/composition.module.ts`

```typescript
@Module({
  imports: [IndexingModule],
  providers: [CompositionResolver],
})
export class CompositionModule {}
```

### 7.4 Update App Module

**Update:** `/api/src/app.module.ts`

```typescript
imports: [
  // ... existing imports
  IndexingModule,
  NotionModule,
  CompositionModule,
]
```

---

## Phase 8: Cleanup

### 8.1 Remove Old Files

**Delete:**
- `/api/src/email/email-indexing.service.ts`
- `/api/src/email/email.service.ts`
- `/api/src/email/email-indexing.queue.ts`
- `/api/src/email/email-indexing.processor.ts`
- `/api/src/email/schemas/email.schema.ts`
- `/api/src/email/schemas/email-embedding.schema.ts`

### 8.2 Update Email Resolver

**Update:** `/api/src/email/email.resolver.ts`

Remove queries:
- `emails`
- `emailThreads`
- `emailThread`
- `emailContent`

Keep:
- `createDraftReply` (for Gmail draft creation)

---

## Environment Variables

Add to `.env`:

```
# OpenAI
OPENAI_API_KEY=your_openai_key

# Notion OAuth
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback

# MongoDB (ensure vector search is enabled in Atlas)
MONGODB_URI=mongodb+srv://...
```

---

## MongoDB Atlas Vector Search Setup

### For Each Collection:

1. Go to MongoDB Atlas → Search → Create Search Index
2. Choose "JSON Editor"
3. Collection: `gmailembeddings`, `notionembeddings`, `twitterembeddings`
4. Index Definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    }
  ]
}
```

---

## Testing Checklist

- [ ] Gmail OAuth and initial indexing works
- [ ] Gmail incremental sync with historyId works
- [ ] Notion OAuth authentication works
- [ ] Notion initial indexing with block-boundary chunking works
- [ ] Multi-platform dashboard shows correct status
- [ ] Vector search returns relevant results across sources
- [ ] `composeDraft` mutation generates Gmail drafts
- [ ] `composeTweet` mutation generates Twitter replies
- [ ] Chrome extension UI appears on Gmail
- [ ] Chrome extension injects drafted content correctly

---

## Next Steps

1. Install dependencies: `npm install @notionhq/client`
2. Create remaining Twitter schemas
3. Implement GmailIndexerService
4. Implement NotionIndexerService
5. Implement VectorSearchService
6. Create GraphQL resolvers
7. Test end-to-end flow

---

This is a comprehensive refactoring. Focus on one phase at a time.

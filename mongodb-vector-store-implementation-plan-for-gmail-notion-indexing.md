# MongoDB Vector Store Implementation Plan for Gmail & Notion Indexing

## Overview

This plan establishes a MongoDB-based vector store architecture to index Gmail emails and Notion pages for RAG-powered email composition. The system uses **separate collections per data source** (gmail-embeddings, notion-embeddings) with **denormalized metadata** to optimize for vector search performance while maintaining source-specific query flexibility. Notion content will be chunked using **block-boundary chunking** to preserve semantic coherence, while Gmail draft injection uses **direct DOM manipulation** for reliability. **Cursor-based polling with change tokens** ensures incremental synchronization keeps embeddings fresh without full reprocessing.

## Core Components

### 1. MongoDB Collection Schema

#### A. Gmail Collections

**Collection: `gmail-embeddings`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,              // Reference to user
  emailId: String,                // Gmail message ID
  chunkIndex: Number,             // Sequential chunk number within email
  embedding: Array<Number>,       // 1536-dim vector (text-embedding-3-small)
  content: String,                // Original text chunk
  metadata: {
    // Denormalized email metadata
    from: String,
    to: Array<String>,
    subject: String,
    date: ISODate,
    threadId: String,
    labels: Array<String>,
    snippet: String,              // Email preview
    // Chunk-specific metadata
    position: String,             // 'subject', 'body_start', 'body_middle', 'body_end'
    hasAttachments: Boolean
  },
  syncToken: String,              // Gmail API history token
  createdAt: ISODate,
  updatedAt: ISODate
}

// Indexes
db.gmail-embeddings.createIndex({ 
  userId: 1, 
  embedding: "vector" 
}, { 
  vectorOptions: { 
    kind: "hnsw", 
    dimensions: 1536, 
    similarity: "cosine" 
  } 
});
db.gmail-embeddings.createIndex({ userId: 1, emailId: 1, chunkIndex: 1 });
db.gmail-embeddings.createIndex({ userId: 1, syncToken: 1 });
db.gmail-embeddings.createIndex({ "metadata.threadId": 1 });
```

**Collection: `gmail-sync-state`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  historyId: String,              // Gmail API history ID for incremental sync
  lastSyncedAt: ISODate,
  status: String,                 // 'syncing', 'completed', 'error'
  errorMessage: String
}
```

#### B. Notion Collections

**Collection: `notion-embeddings`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  pageId: String,                 // Notion page UUID
  blockId: String,                // Notion block UUID
  chunkIndex: Number,             // If block is chunked further
  embedding: Array<Number>,       // 1536-dim vector
  content: String,                // Block text content
  metadata: {
    // Denormalized page metadata
    pageTitle: String,
    workspaceId: String,
    parentPageId: String,         // For hierarchy context
    breadcrumb: Array<String>,    // ['Workspace', 'Parent Page', 'Current Page']
    // Block-specific metadata
    blockType: String,            // 'paragraph', 'heading_1', 'heading_2', 'bulleted_list', 'code', etc.
    hasChildren: Boolean,
    createdTime: ISODate,
    lastEditedTime: ISODate,
    // Rich metadata for context
    tags: Array<String>,          // Extracted from page properties
    databaseId: String            // If block is in a database
  },
  syncCursor: String,             // Notion API pagination cursor
  createdAt: ISODate,
  updatedAt: ISODate
}

// Indexes
db.notion-embeddings.createIndex({ 
  userId: 1, 
  embedding: "vector" 
}, { 
  vectorOptions: { 
    kind: "hnsw", 
    dimensions: 1536, 
    similarity: "cosine" 
  } 
});
db.notion-embeddings.createIndex({ userId: 1, pageId: 1 });
db.notion-embeddings.createIndex({ userId: 1, syncCursor: 1 });
db.notion-embeddings.createIndex({ "metadata.lastEditedTime": -1 });
```

**Collection: `notion-sync-state`**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  cursor: String,                 // Notion API pagination cursor
  lastSyncedAt: ISODate,
  status: String,
  errorMessage: String
}
```

### 2. Chunking Strategy

#### A. Gmail Email Chunking
- **Strategy**: Semantic-aware text chunking with 500 tokens per chunk
- **Implementation**:
  - Subject line: Separate chunk (position: 'subject')
  - Email body: Split at paragraph boundaries when possible
  - Character limit: ~2000 characters per chunk (approximates 500 tokens)
  - Overlap: 100-character sliding window between chunks for context continuity
  - Preserve thread context in metadata

#### B. Notion Block-Boundary Chunking
- **Strategy**: Respect Notion's block structure for semantic coherence
- **Implementation**:
  - **Single-block chunks**: Headings, paragraphs, list items, callouts (if < 2000 chars)
  - **Multi-block aggregation**: Combine consecutive small blocks (< 200 chars each) until reaching 1500-2000 chars
  - **Block splitting**: For large blocks (code blocks, long paragraphs > 2000 chars), split at sentence boundaries with 100-char overlap
  - **Hierarchy preservation**: Include parent heading and breadcrumb in metadata
  - **Special handling**:
    - **Databases**: Index row content with column headers as context
    - **Code blocks**: Keep language identifier in metadata
    - **Toggle lists**: Expand and index nested content with parent context

### 3. Embedding Generation Pipeline

#### A. API Service Structure (`api/src/services/`)

**`embedding.service.ts`**
```typescript
class EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    // Use OpenAI text-embedding-3-small (1536 dimensions)
    // Handles batching (up to 100 texts per request)
    // Returns normalized embedding vector
  }
  
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    // Process in batches of 100 for efficiency
  }
}
```

**`gmail-indexer.service.ts`**
```typescript
class GmailIndexerService {
  async indexUserEmails(userId: string): Promise<void> {
    // 1. Fetch emails via Gmail API (batch: 100 messages)
    // 2. Chunk email content (subject + body)
    // 3. Generate embeddings (batch processing)
    // 4. Store in gmail-embeddings collection with denormalized metadata
    // 5. Update gmail-sync-state with historyId
  }
  
  async incrementalSync(userId: string): Promise<void> {
    // 1. Fetch historyId from gmail-sync-state
    // 2. Call Gmail API's history.list with historyId
    // 3. Process added/modified messages
    // 4. Delete embeddings for trashed messages
    // 5. Update historyId
  }
}
```

**`notion-indexer.service.ts`**
```typescript
class NotionIndexerService {
  async indexUserNotion(userId: string): Promise<void> {
    // 1. Fetch pages via Notion API (paginated)
    // 2. For each page, fetch blocks recursively
    // 3. Chunk blocks using block-boundary strategy
    // 4. Generate embeddings (batch processing)
    // 5. Store in notion-embeddings with breadcrumb metadata
    // 6. Update notion-sync-state with cursor
  }
  
  async incrementalSync(userId: string): Promise<void> {
    // 1. Use Notion Search API with last_edited_time filter
    // 2. Fetch updated pages since lastSyncedAt
    // 3. Delete old embeddings for updated pages
    // 4. Re-chunk and re-embed updated content
    // 5. Update cursor
  }
}
```

#### B. Initial Bulk Indexing Workflow

**Endpoint**: `POST /api/indexing/start`
```typescript
async startIndexing(userId: string) {
  // 1. Queue background job (Bull/BullMQ recommended)
  await indexingQueue.add('gmail-indexing', { userId });
  await indexingQueue.add('notion-indexing', { userId });
  
  // 2. Return job IDs for status polling
}
```

**Job Processing**:
- Use Bull queues with rate limiting (Gmail API: 250 quota units/user/sec)
- Process emails/pages in batches of 50
- Retry failed embeddings with exponential backoff
- Store progress in sync-state collections

### 4. Incremental Synchronization

#### A. Cursor-Based Polling Architecture

**Sync Scheduler** (`api/src/jobs/sync-scheduler.ts`)
```typescript
class SyncScheduler {
  async scheduleUserSync(userId: string, source: 'gmail' | 'notion') {
    // Run every 15 minutes via cron (adjust based on usage)
    if (source === 'gmail') {
      await gmailIndexerService.incrementalSync(userId);
    } else {
      await notionIndexerService.incrementalSync(userId);
    }
  }
}
```

**Gmail Incremental Sync**:
- Use `historyId` from previous sync
- Call `gmail.users.history.list()` to get changes since last sync
- Process:
  - `messagesAdded`: Index new emails
  - `messagesDeleted`: Remove embeddings
  - `labelsAdded/labelsRemoved`: Update metadata only (no re-embedding)
- Update `historyId` in sync-state

**Notion Incremental Sync**:
- Notion lacks native change tokens, so use polling:
  - Query pages with `last_edited_time > lastSyncedAt`
  - Compare block hashes to detect changes
  - Re-chunk and re-embed only modified pages
  - Delete old embeddings before inserting new ones

**Sync Frequency**:
- Gmail: Every 5-10 minutes (low cost, uses historyId)
- Notion: Every 15-30 minutes (more expensive, full page comparison)
- Configurable per user based on plan tier

### 5. Vector Search & Retrieval

#### A. Query Service (`api/src/services/vector-search.service.ts`)

```typescript
class VectorSearchService {
  async searchRelevantContext(
    userId: string,
    query: string,
    options: {
      sources?: ('gmail' | 'notion')[],
      limit?: number,
      filters?: Record<string, any>
    }
  ): Promise<SearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    // 2. Search across selected sources (parallel queries)
    const results = await Promise.all([
      this.searchGmail(userId, queryEmbedding, options),
      this.searchNotion(userId, queryEmbedding, options)
    ]);
    
    // 3. Merge and re-rank by cosine similarity
    // 4. Return top N results with full metadata
  }
  
  private async searchGmail(userId, embedding, options) {
    return db.collection('gmail-embeddings').aggregate([
      {
        $vectorSearch: {
          index: "gmail_vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 100,
          limit: options.limit || 20,
          filter: { userId: new ObjectId(userId), ...options.filters }
        }
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]);
  }
}
```

#### B. RAG Integration for Email Composition

**Endpoint**: `POST /api/compose/draft`
```typescript
async composeDraft(userId: string, prompt: string, context: {
  currentEmailThread?: string,
  replyTo?: string
}) {
  // 1. Search vector store for relevant context
  const relevantContext = await vectorSearchService.searchRelevantContext(
    userId,
    prompt,
    {
      sources: ['gmail', 'notion'],
      limit: 10,
      filters: {
        // Prioritize same thread if replying
        ...(context.currentEmailThread && {
          'metadata.threadId': context.currentEmailThread
        })
      }
    }
  );
  
  // 2. Build LLM prompt with retrieved context
  const systemPrompt = `You are an email assistant. Use the following context to compose a response:\n\n${relevantContext.map(r => r.content).join('\n\n')}`;
  
  // 3. Call LLM (OpenAI GPT-4)
  const draft = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  });
  
  // 4. Return draft content
  return draft.choices[0].message.content;
}
```

### 6. Chrome Extension Integration

#### A. Draft Injection via Direct DOM Manipulation

**File**: `extension/src/content-scripts/gmail-injector.ts`

```typescript
class GmailDraftInjector {
  private findComposeBox(): HTMLElement | null {
    // Gmail uses contenteditable divs with role="textbox"
    // Multiple selectors for reliability:
    return document.querySelector('div[role="textbox"][aria-label*="Message Body"]') ||
           document.querySelector('.Am.Al.editable') ||
           document.querySelector('div[g_editable="true"]');
  }
  
  async injectDraft(draftContent: string): Promise<void> {
    // 1. Click reply button if not already in compose mode
    const replyButton = document.querySelector('div[role="button"][aria-label*="Reply"]');
    if (replyButton) {
      (replyButton as HTMLElement).click();
      await this.waitForComposeBox();
    }
    
    // 2. Find compose box
    const composeBox = this.findComposeBox();
    if (!composeBox) {
      throw new Error('Compose box not found');
    }
    
    // 3. Insert content (preserves Gmail's formatting)
    composeBox.focus();
    
    // Use document.execCommand for compatibility with Gmail's editor
    document.execCommand('selectAll', false);
    document.execCommand('insertHTML', false, draftContent);
    
    // Trigger input event for Gmail's autosave
    composeBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private async waitForComposeBox(timeout = 2000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.findComposeBox()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Compose box did not appear');
  }
}
```

**Reliability Considerations**:
- Use MutationObserver to detect Gmail DOM changes
- Fallback selectors for different Gmail UI variants (classic, new)
- Error handling with user notifications
- Test across Gmail themes and layouts

### 7. API Routes

**Indexing Routes**:
```
POST   /api/indexing/start           - Start initial bulk indexing
GET    /api/indexing/status/:userId  - Check indexing progress
POST   /api/indexing/sync             - Trigger manual sync
```

**Composition Routes**:
```
POST   /api/compose/draft             - Generate email draft with RAG
GET    /api/compose/context/:query    - Search vector store for context
```

**OAuth Routes** (existing):
```
GET    /api/auth/gmail/authorize      - Initiate Gmail OAuth
GET    /api/auth/gmail/callback       - Handle OAuth callback
POST   /api/auth/notion/integrate     - Connect Notion workspace
```

### 8. Future Scalability

**Extending to New Data Sources** (Slack, Google Drive):

1. **Create new collection**: `{source}-embeddings` (e.g., `slack-embeddings`)
2. **Implement indexer service**: `{source}-indexer.service.ts`
3. **Add sync-state collection**: `{source}-sync-state`
4. **Update vector search**: Add new source to parallel queries
5. **Handle source-specific chunking**: Adapt to data structure (Slack threads, Drive docs)

**Schema Pattern for New Sources**:
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  sourceId: String,               // Source-specific ID
  chunkIndex: Number,
  embedding: Array<Number>,
  content: String,
  metadata: {                     // Source-specific metadata
    // Denormalize commonly queried fields
    // Include hierarchical context (threads, folders, etc.)
  },
  syncToken: String,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

---

## Implementation Steps Summary

1. **Set up MongoDB Atlas** with vector search enabled
2. **Create collections and indexes** for gmail-embeddings, notion-embeddings, sync-state collections
3. **Implement embedding service** using OpenAI text-embedding-3-small
4. **Build indexer services** for Gmail and Notion with bulk + incremental sync
5. **Create sync scheduler** with cursor-based polling (cron jobs)
6. **Implement vector search service** with cross-source retrieval
7. **Build RAG composition endpoint** that combines retrieval + LLM generation
8. **Develop Chrome extension injector** with direct DOM manipulation
9. **Add API routes** for indexing control and draft composition
10. **Test end-to-end flow**: Authenticate → Index → Compose → Inject

---

This plan provides a production-ready architecture that balances performance (denormalized metadata for fast queries), scalability (separate collections for easy extension), and data freshness (cursor-based incremental sync). The denormalized approach avoids expensive joins during vector search, while block-boundary chunking preserves semantic meaning in Notion content.
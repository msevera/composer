# Gmail Draft Composition Agent Implementation Plan

## Overview

Build a **LangGraph-powered email draft composition agent** integrated into your existing NestJS GraphQL API. The agent will orchestrate multiple data sources (Gmail threads, email search, Google Calendar) and use Human-in-the-Loop patterns to compose contextually-aware email drafts based on user prompts.

**Architecture**: The agent will be co-located within the `composition` module as a specialized service (`CompositionAgentService`), leveraging LangGraph for workflow orchestration and LangChain tools for API integrations. The agent uses a **ReAct-style graph** with conditional edges for dynamic tool selection and interrupt points for user clarification.

## Core Components

### 1. **Project Setup & Dependencies**

**Location**: Root project files

**Actions**:
- Install LangGraph and LangChain packages:
  ```bash
  npm install @langchain/langgraph @langchain/core @langchain/openai
  ```
- Install Gmail/Google API client libraries:
  ```bash
  npm install googleapis @types/googleapis
  ```
- Configure environment variables in `.env`:
  ```
  OPENAI_API_KEY=your_openai_key
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_API_KEY=your_langsmith_key  # Optional for debugging
  ```

### 2. **LangGraph Agent Service**

**Location**: `src/composition/services/composition-agent.service.ts`

**Purpose**: Core orchestration service that implements the LangGraph workflow

**Key Responsibilities**:
- Define the agent state schema (TypeScript interface extending `MessagesAnnotation`)
- Implement the graph structure with nodes for:
  - `agent` node: LLM decision-making using tool-calling
  - `tools` node: Tool execution router
  - `human` node: Interrupt point for user clarification
- Configure conditional routing logic between nodes
- Manage checkpointing for conversation persistence
- Handle state compilation and invocation

**State Schema**:
```typescript
interface AgentState extends MessagesAnnotation {
  threadId?: string;
  userId: string;
  userAccessToken: string;
  userPrompt: string;
  draftContent?: string;
  requiresUserInput?: boolean;
  clarificationQuestion?: string;
}
```

**Graph Structure**:
- **Entry point**: `agent` node
- **Conditional edges**: 
  - `agent` → `tools` (when tools are called)
  - `agent` → `human` (when clarification needed via interrupt)
  - `agent` → `END` (when draft is ready)
  - `tools` → `agent` (after tool execution)
  - `human` → `agent` (after user provides input)

### 3. **LangChain Tool Implementations**

**Location**: `src/composition/tools/` (new directory)

Create separate tool files using LangChain's `DynamicStructuredTool` or `StructuredTool` class:

#### **3a. Gmail Thread Loader Tool**
**File**: `src/composition/tools/gmail-thread-loader.tool.ts`

**Purpose**: Fetch complete email thread history from Gmail API

**Implementation**:
- Use `googleapis` library to call `gmail.users.threads.get()`
- Parse thread messages (sender, recipient, subject, body, timestamp)
- Return formatted thread context as a string
- Handle authentication using the provided `userAccessToken`

**Input Schema**: `{ threadId: string, userId: string, userAccessToken: string }`

**Integration Pattern**:
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const gmailThreadLoaderTool = new DynamicStructuredTool({
  name: 'load_gmail_thread',
  description: 'Loads a complete email thread from Gmail to understand context',
  schema: z.object({
    threadId: z.string(),
  }),
  func: async ({ threadId }, runManager) => {
    // Implementation calls GmailService
  },
});
```

#### **3b. Gmail Search Tool**
**File**: `src/composition/tools/gmail-search.tool.ts`

**Purpose**: Search user's Gmail for relevant emails using Gmail query syntax

**Implementation**:
- Use `gmail.users.messages.list()` with query parameter
- Support Gmail search operators (from:, to:, subject:, after:, etc.)
- Return summarized search results (subject, sender, snippet, date)
- Limit results to prevent context overflow (default: 10 results)

**Input Schema**: `{ query: string, maxResults?: number }`

#### **3c. Google Calendar Tool**
**File**: `src/composition/tools/google-calendar.tool.ts`

**Purpose**: Retrieve calendar events for scheduling context

**Implementation**:
- Use Google Calendar API (`calendar.events.list()`)
- Query upcoming events within a time window
- Return formatted event list (title, start/end time, attendees, location)
- Handle timezone conversions

**Input Schema**: `{ timeMin: string, timeMax: string, maxResults?: number }`

#### **3d. Human Input Tool (Clarification)**
**File**: `src/composition/tools/human-input.tool.ts`

**Purpose**: Trigger interrupt for user clarification via Human-in-the-Loop pattern

**Implementation**:
- Use LangGraph's `interrupt()` mechanism
- Set `requiresUserInput: true` in state
- Store clarification question in state
- Graph execution pauses until `.invoke()` is called again with user response

**Pattern**:
```typescript
import { interrupt } from '@langchain/langgraph';

const humanInputTool = new DynamicStructuredTool({
  name: 'ask_user_for_clarification',
  description: 'Ask the user a clarifying question when information is ambiguous',
  schema: z.object({
    question: z.string(),
  }),
  func: async ({ question }) => {
    const userResponse = interrupt(question);
    return userResponse;
  },
});
```

### 4. **NestJS Integration Layer**

**Location**: `src/composition/composition.service.ts` (existing service)

**Modifications**:
- Inject the new `CompositionAgentService`
- Create a new method `composeDraftWithAgent()` that:
  - Accepts GraphQL input (threadId, userId, userAccessToken, userPrompt)
  - Initializes agent state
  - Invokes the LangGraph agent
  - Handles checkpointing with thread-specific checkpoint IDs
  - Returns draft content or signals need for user input

**Checkpoint Management**:
- Use `MemorySaver` (development) or `PostgresSaver` (production) for persistence
- Generate checkpoint `thread_id` from composition context (e.g., `composition-${userId}-${threadId}`)
- Enable resume functionality for interrupted conversations

### 5. **GraphQL API Extension**

**Location**: 
- `src/composition/dto/composition.input.ts` (new DTO)
- `src/composition/composition.resolver.ts` (existing resolver)

**New Mutation**:
```graphql
mutation ComposeDraftWithAgent(
  $input: ComposeDraftAgentInput!
) {
  composeDraftWithAgent(input: $input) {
    ... on DraftResult {
      draftContent
      status
    }
    ... on ClarificationRequired {
      question
      conversationId
    }
  }
}
```

**Response Types**:
- `DraftResult`: Contains the final draft content
- `ClarificationRequired`: Contains clarification question and conversation ID for resumption

**Resume Mutation** (for Human-in-the-Loop):
```graphql
mutation ResumeDraftComposition(
  $conversationId: String!
  $userResponse: String!
) {
  resumeDraftComposition(
    conversationId: $conversationId
    userResponse: $userResponse
  ) {
    # Same union type as above
  }
}
```

### 6. **Agent Prompt Engineering**

**Location**: Within `CompositionAgentService` system prompt

**System Message Template**:
```typescript
const systemPrompt = `You are an email composition assistant. Your goal is to draft professional, contextually-aware email responses.

You have access to these tools:
- load_gmail_thread: Retrieve the full conversation history
- search_gmail: Find relevant past emails
- get_calendar_events: Check scheduling availability
- ask_user_for_clarification: Request additional information from the user

Guidelines:
1. Always load the thread context when threadId is provided
2. Search for relevant emails if the user references past conversations
3. Check calendar availability when scheduling meetings
4. Ask clarifying questions if the user's intent is ambiguous
5. Draft a complete, professional email with appropriate tone
6. Include relevant context from tools in your draft

When ready, provide the draft in a structured format.`;
```

### 7. **Testing Strategy**

**Unit Tests**:
- **Tool Tests** (`src/composition/tools/*.spec.ts`):
  - Mock Gmail API responses
  - Verify tool input/output schemas
  - Test error handling (invalid tokens, API failures)

- **Agent Service Tests** (`src/composition/services/composition-agent.service.spec.ts`):
  - Mock LangGraph graph execution
  - Test state transitions
  - Verify conditional routing logic

**Integration Tests**:
- **End-to-End Flow** (`test/composition-agent.e2e-spec.ts`):
  - Test complete workflow from GraphQL mutation to draft generation
  - Mock external APIs (Gmail, Calendar)
  - Test Human-in-the-Loop interrupt/resume cycle
  - Verify checkpoint persistence and recovery

**Manual Testing**:
- Use LangSmith tracing (enable with `LANGCHAIN_TRACING_V2=true`)
- Test with real Gmail API in development environment
- Validate agent decision-making across various scenarios:
  - Simple replies
  - Meeting scheduling requests
  - Multi-turn clarifications
  - Email search contexts

### 8. **Future Extensions Preparation**

**Vector Retrieval Integration Points**:

**Location**: `src/composition/tools/vector-search.tool.ts` (future)

**Design Considerations**:
- Create abstract tool interface for knowledge sources
- Implement vector search tool following same pattern as Gmail tools
- Use semantic search over:
  - Notion documents
  - Internal knowledge bases
  - Previous email embeddings (long-term memory)

**Recommended Approach**:
- Use LangChain's `VectorStoreRetriever` abstraction
- Integrate with vector databases (Pinecone, Weaviate, or Supabase pgvector)
- Add embeddings generation for email history (background job)
- Create new tool: `search_knowledge_base` with similar schema to Gmail search

**State Schema Extension**:
```typescript
interface AgentState extends MessagesAnnotation {
  // ... existing fields
  retrievedDocuments?: Document[];  // For vector search results
  knowledgeSources?: string[];      // Track which sources were used
}
```

---

## Implementation Order

1. **Setup Phase**: Install dependencies, configure environment
2. **Tools Layer**: Implement Gmail and Calendar tools with unit tests
3. **Agent Core**: Build `CompositionAgentService` with graph structure
4. **Integration Layer**: Wire into existing NestJS services
5. **API Layer**: Add GraphQL mutations and response types
6. **Testing**: Write integration tests and validate with LangSmith
7. **Refinement**: Prompt engineering and error handling improvements

---

## Key Technical Decisions

- **Agent Location**: Co-located in `composition` module for tight integration with composition use case
- **Checkpointing**: Use memory-based initially, migrate to PostgreSQL for production persistence
- **Tool Architecture**: Separate tool files using LangChain's structured tool pattern for maintainability
- **Human-in-the-Loop**: Use LangGraph's native `interrupt()` mechanism with stateful resume
- **Authentication**: Pass `userAccessToken` through agent state, tools use it for API calls
- **LLM Model**: OpenAI (default via `@langchain/openai`), configurable for other providers

---

This plan provides a complete roadmap for implementing your Gmail draft composition agent. The architecture is extensible for future vector retrieval features while maintaining clean separation of concerns within your existing NestJS structure.
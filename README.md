# Smail - Gmail Email Management System

A monorepo application for managing Gmail emails with AI-powered features, built with NestJS, GraphQL, MongoDB, and Next.js.

## Project Structure

```
smail/
├── api/          # NestJS GraphQL API
└── web/          # Next.js frontend
```

## Features

- User authentication with Better-Auth
- Gmail OAuth integration
- Email listing with threading
- Cursor-based pagination
- On-demand email content fetching
- Email metadata indexing
- Embedding generation for future RAG features
- MongoDB Atlas Vector Search support

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google Cloud Console project with Gmail API enabled
- OpenAI API key (for embeddings)

### API Setup

1. Navigate to the API directory:
```bash
cd api
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/smail
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OPENAI_API_KEY=your-openai-api-key
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
PORT=4000
```

**Note**: Redis is required for the email indexing job queue. Install Redis locally or use a cloud Redis service.

4. Start the API server:
```bash
npm run dev
```

### Web Setup

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:4000/api/auth
```

4. Start the development server:
```bash
npm run dev
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:4000/api/auth/callback/google`
   - Copy the Client ID and Client Secret to your `.env` file

## MongoDB Atlas Vector Search Setup

To enable vector search for email embeddings:

1. Go to your MongoDB Atlas cluster
2. Navigate to "Atlas Search" > "Create Search Index"
3. Create a vector search index on the `email-embeddings` collection:
   - Index name: `email_embedding_index`
   - Database: `smail` (or your database name)
   - Collection: `email-embeddings`
   - Index definition:
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 1536,
         "similarity": "cosine"
       }
     ]
   }
   ```

## Usage

1. Start both API and Web servers
2. Navigate to `http://localhost:3000`
3. Sign up or sign in
4. Connect your Gmail account
5. Emails from the last day will be automatically indexed
6. View emails at `http://localhost:3000/emails`
7. Click on any email to view full content

## GraphQL API

The API provides the following queries and mutations:

### Queries

- `emails(cursor, limit, threadId, isRead)` - Get paginated emails
- `emailThreads(cursor, limit)` - Get email threads
- `emailThread(threadId)` - Get all emails in a thread
- `emailContent(messageId)` - Get full email content (fetches on demand)

### Mutations

- `indexInitialEmails` - Index last day of emails
- `indexEmail(messageId)` - Index a specific email

## Development

### API

```bash
cd api
npm run dev        # Start with watch mode
npm run build      # Build for production
npm run start:prod # Start production server
```

### Web

```bash
cd web
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
```

## Future Features

- AI-powered email composition using RAG
- Email search using embeddings
- Related email suggestions
- Email categorization
- Smart email summaries

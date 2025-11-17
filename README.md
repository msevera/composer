# Smail Monorepo

Monorepo containing API and Web applications.

## Structure

- `api/` - NestJS + GraphQL + MongoDB API
- `web/` - Next.js + Apollo GraphQL Web Application

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Servers

```bash
# Run both API and Web
npm run dev

# Or run individually
npm run dev:api
npm run dev:web
```

## API

The API is built with NestJS, GraphQL, and MongoDB. It uses Better-Auth for authentication.

### Environment Variables

Create a `.env` file in the `api/` directory:

```
MONGODB_URI=mongodb://localhost:27017/smail
PORT=4000
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Google OAuth Setup

To enable Gmail and Calendar integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:4000/api/auth/callback/google`
5. Copy the Client ID and Client Secret to your `.env` file

## Web

The Web application is built with Next.js and Apollo GraphQL.

### Environment Variables

Create a `.env.local` file in the `web/` directory:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
```


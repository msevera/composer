import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';
import { google, gmail_v1 } from 'googleapis';
import { AuthService } from '@thallesp/nestjs-better-auth';

@Injectable()
export class GmailService {
  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
    private authService: AuthService,
  ) { }
  private ensureGoogleOAuthConfig() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    return { clientId, clientSecret };
  }

  async getValidAccessToken(userId: string, accountId?: string): Promise<string> {
    const { accessToken } = await this.authService.api.getAccessToken({
      body: {
        providerId: 'google',
        accountId: accountId,
        userId: userId,
      },
    });

    return accessToken;
  }

  private async getGmailClient(userId: string, accountId?: string): Promise<gmail_v1.Gmail> {    
    const accessToken = await this.getValidAccessToken(userId, accountId);
    const { clientId, clientSecret } = this.ensureGoogleOAuthConfig();
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth });
  }

  private formatGoogleError(error: unknown) {
    if (error && typeof error === 'object') {
      const anyError = error as Record<string, any>;
      const message = anyError.message || anyError.code || 'Unknown error';
      const responseData = anyError.response?.data ? JSON.stringify(anyError.response.data) : '';
      return responseData ? `${message}: ${responseData}` : message;
    }
    return String(error);
  }

  /**
   * List messages with pagination support
   * @param userId User ID
   * @param pageToken Optional page token for pagination
   * @param maxResults Maximum number of results (default: 50)
   * @param query Optional query string (e.g., "after:2024/01/01")
   */
  async listMessages(
    userId: string,
    pageToken?: string,
    maxResults: number = 50,
    query?: string,
    accountId?: string,
  ): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    const gmail = await this.getGmailClient(userId, accountId);
    try {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        pageToken,
        maxResults,
        q: query,
      });
      const normalizedMessages = (data.messages ?? []).flatMap((message) => {
        if (message?.id && message?.threadId) {
          return [{ id: message.id, threadId: message.threadId }];
        }
        return [];
      });
      return {
        messages: normalizedMessages,
        nextPageToken: data.nextPageToken,
        resultSizeEstimate: data.resultSizeEstimate ?? 0,
      };
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to list messages:', message);
      throw new Error(`Failed to list Gmail messages: ${message}`);
    }
  }

  /**
   * Get multiple messages in bulk (parallel requests with concurrency limit)
   * @param userId User ID
   * @param messageIds Array of Gmail message IDs
   * @param format Message format: 'full', 'metadata', 'minimal', 'raw' (default: 'metadata')
   * @param concurrency Maximum number of parallel requests (default: 10)
   * @returns Array of message objects, with null for failed requests
   */
  async getMessagesBulk(
    userId: string,
    messageIds: string[],
    format: 'full' | 'metadata' | 'minimal' | 'raw' = 'metadata',
    accountId?: string,
    concurrency: number = 10,
  ): Promise<Array<any | null>> {
    const gmail = await this.getGmailClient(userId, accountId);
    const results: Array<any | null> = new Array(messageIds.length).fill(null);

    for (let i = 0; i < messageIds.length; i += concurrency) {
      const batch = messageIds.slice(i, i + concurrency);

      const batchPromises = batch.map(async (messageId) => {
        try {
          const { data } = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format,
          });
          return data;
        } catch (error) {
          console.error(`Error fetching message ${messageId}:`, this.formatGoogleError(error));
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Store results in the correct positions
      batchResults.forEach((result, batchIndex) => {
        results[i + batchIndex] = result;
      });
    }

    return results;
  }

  /**
   * Get all messages in a thread
   * @param userId User ID
   * @param threadId Gmail thread ID
   */
  async getThread(userId: string, threadId: string, accountId?: string): Promise<any> {
    const gmail = await this.getGmailClient(userId, accountId);
    try {
      const { data } = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });
      return data;
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to get thread:', message);
      throw new Error(`Failed to get Gmail thread: ${message}`);
    }
  }

  async disconnectGmail(userId: string): Promise<boolean> {
    const db = this.connection.db;

    const userIdString = userId.toString();
    const queries: Record<string, any>[] = [
      { userId: userIdString, providerId: 'google' },
      { userId: userIdString, provider: 'google' },
    ];

    if (ObjectId.isValid(userIdString)) {
      const objectId = new ObjectId(userIdString);
      queries.push({ userId: objectId, providerId: 'google' });
      queries.push({ userId: objectId, provider: 'google' });
    }

    for (const filter of queries) {
      const result = await db.collection('accounts').deleteOne(filter);
      if (result.deletedCount > 0) {
        return true;
      }
    }

    return false;
  }

  summarizeThread(thread: gmail_v1.Schema$Thread | null | undefined, maxMessages = 5) {
    const messages = thread?.messages ?? [];
    if (!messages.length) {
      return 'Thread is empty.';
    }
    const latest = messages.slice(-maxMessages);
    return latest
      .map((message, index) => {
        const from = this.extractHeader(message, 'from') || 'Unknown sender';
        const subject = this.extractHeader(message, 'subject') || 'No subject';
        const body = this.extractMessageBody(message);
        const preview = this.sanitizePreview(body || message?.snippet || '');
        const emailIndex = messages.length - latest.length + index + 1;
        return [
          `<email_${emailIndex}>`,
          `From: ${from}`,
          `Subject: ${subject}`,
          `Message: ${preview}`,
          `</email_${emailIndex}>`
        ].join('\n');
      })
      .join('\n');
  }

  buildRecipientSummary(thread: gmail_v1.Schema$Thread | null | undefined) {
    const messages = thread?.messages ?? [];
    if (!messages.length) {
      return null;
    }
    const latestIncoming = [...messages].reverse().find((message) => {
      const labels: string[] = message?.labelIds ?? [];
      return !labels.includes('SENT');
    });
    const referenceMessage = latestIncoming ?? messages[messages.length - 1];
    const primarySender = this.extractHeader(referenceMessage, 'reply-to') || this.extractHeader(referenceMessage, 'from');
    const originalTo = this.extractHeader(referenceMessage, 'to');
    const originalCc = this.extractHeader(referenceMessage, 'cc');
    const subject = this.extractHeader(referenceMessage, 'subject');
    const date = this.extractHeader(referenceMessage, 'date') || referenceMessage?.internalDate;
    const participants = this.collectThreadParticipants(messages, primarySender);
    const lines = [];
    if (primarySender) {
      lines.push(`Primary recipient for this reply: ${primarySender}`);
    }
    if (originalTo) {
      lines.push(`Latest "To" line: ${originalTo}`);
    }
    if (originalCc) {
      lines.push(`Latest "Cc" line: ${originalCc}`);
    }
    if (subject) {
      lines.push(`Subject to reference: ${subject}`);
    }
    if (date) {
      lines.push(`Most recent incoming message date: ${date}`);
    }
    if (participants.length) {
      lines.push(`Other thread participants: ${participants.join(', ')}`);
    }
    if (!lines.length) {
      return null;
    }
    return lines.join('\n');
  }

  summarizeMessages(messages: Array<gmail_v1.Schema$Message | null>) {
    if (!messages.length) {
      return 'No historical results.';
    }
    return messages
      .filter(Boolean)
      .map((message) => {
        const subject = this.extractHeader(message, 'subject') || 'No subject';
        const from = this.extractHeader(message, 'from') || 'Unknown sender';
        const body = this.sanitizePreview(this.extractMessageBody(message) || message?.snippet || '');
        return `Subject: ${subject}\nFrom: ${from}\nBody:\n${body}`;
      })
      .join('\n');
  }

  private extractHeader(message: gmail_v1.Schema$Message | null | undefined, name: string) {
    const headers = message?.payload?.headers ?? [];
    const header = headers.find((h) => h?.name?.toLowerCase() === name.toLowerCase());
    return header?.value;
  }

  private extractMessageBody(message: gmail_v1.Schema$Message | null | undefined) {
    const payload = message?.payload;
    if (!payload) {
      return '';
    }
    const { text, html } = this.extractBodiesFromPayload(payload);
    if (text) {
      return this.sanitizePreview(text);
    }
    if (html) {
      return this.sanitizePreview(this.stripHtml(html));
    }
    return '';
  }

  private extractBodiesFromPayload(part: gmail_v1.Schema$MessagePart | null | undefined, bodies: { text?: string; html?: string } = {}) {
    if (!part) {
      return bodies;
    }
    const mime = part.mimeType || '';
    const isAttachment = Boolean(part.filename);
    if (part.body?.data && !isAttachment) {
      const decoded = this.decodeBody(part.body.data);
      if (mime.includes('text/plain')) {
        bodies.text = bodies.text ?? decoded;
      } else if (mime.includes('text/html')) {
        bodies.html = bodies.html ?? decoded;
      } else if (!mime && !bodies.text) {
        bodies.text = decoded;
      }
    }
    if (Array.isArray(part.parts) && part.parts.length) {
      part.parts.forEach((child) => this.extractBodiesFromPayload(child, bodies));
    }
    return bodies;
  }

  private collectThreadParticipants(messages: gmail_v1.Schema$Message[] = [], primaryRecipient?: string | null) {
    const seen = new Set<string>();
    const pushParticipants = (value?: string | null) => {
      if (!value) {
        return;
      }
      this.splitAddressList(value).forEach((entry) => {
        if (entry && entry !== primaryRecipient) {
          seen.add(entry);
        }
      });
    };
    messages.forEach((message) => {
      pushParticipants(this.extractHeader(message, 'from'));
      pushParticipants(this.extractHeader(message, 'to'));
      pushParticipants(this.extractHeader(message, 'cc'));
      pushParticipants(this.extractHeader(message, 'bcc'));
    });
    return Array.from(seen).slice(0, 10);
  }

  private splitAddressList(value: string) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private decodeBody(data: string) {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private sanitizePreview(text?: string | null) {
    if (!text) {
      return '';
    }
    return text
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('>'))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}


import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';
import { google, gmail_v1 } from 'googleapis';

@Injectable()
export class GmailService {
  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
  ) { }
  private readonly refreshLabelName = this.configService.get('GMAIL_REFRESH_LABEL') || 'ComposerAITempRefresh';

  async getGmailAccount(userId: string): Promise<Record<string, any> | null> {
    const db = this.connection.db;

    // Try with userId as string first
    let account = await db.collection('accounts').findOne({
      userId: userId.toString(),
      providerId: 'google',
    });

    // If not found, try with userId as-is (might be ObjectId)
    if (!account) {
      account = await db.collection('accounts').findOne({
        userId: new ObjectId(userId),
        providerId: 'google',
      });
    }

    // Also try with 'provider' field (some adapters use this instead of 'providerId')
    if (!account) {
      account = await db.collection('accounts').findOne({
        userId: userId.toString(),
        provider: 'google',
      });
    }    

    return account;
  }

  async isGmailConnected(userId: string): Promise<boolean> {
    const account = await this.getGmailAccount(userId);
    return !!account;
  }

  async refreshGoogleToken(userId: string) {
    const account = await this.getGmailAccount(userId);
    if (!account) {
      throw new Error('Gmail account not found');
    }

    // Better-Auth might store tokens with different field names
    const refreshToken = account.refreshToken || account.refresh_token;
    if (!refreshToken) {
      throw new Error('No refresh token available. User needs to re-authenticate.');
    }

    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Update the account with new access token
    // Try both field name formats for compatibility
    const updateQuery: any = {
      $set: {
        accessToken: data.access_token,
        access_token: data.access_token, // Better-Auth might use snake_case
        expiresAt: expiresAt,
        expires_at: expiresAt,
      },
    };

    if (data.refresh_token) {
      updateQuery.$set.refreshToken = data.refresh_token;
      updateQuery.$set.refresh_token = data.refresh_token;
    }

    const updated = await this.updateAccountTokens(userId, updateQuery);
    console.log('Token refreshed and saved:', updated);

    return {
      accessToken: data.access_token,
      expiresAt: expiresAt,
    };
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const account = await this.getGmailAccount(userId);
    if (!account) {
      throw new Error('Gmail account not connected');
    }

    // Better-Auth might store tokens with different field names (camelCase vs snake_case)
    const accessToken = account.accessToken || account.access_token;
    const refreshToken = account.refreshToken || account.refresh_token;
    const expiresAt = account.expiresAt
      ? new Date(account.expiresAt)
      : (account.expires_at ? new Date(account.expires_at) : null);

    // If we have an access token, check if it's still valid
    if (accessToken) {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // If token is expired or about to expire, refresh it
      if (!expiresAt || expiresAt < fiveMinutesFromNow) {
        console.log('Access token expired or expiring soon, refreshing...');
        try {
          const refreshed = await this.refreshGoogleToken(userId);
          return refreshed.accessToken;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          throw new Error('Failed to refresh access token. User may need to re-authenticate.');
        }
      }

      return accessToken;
    }

    // No access token, but we might have a refresh token
    if (refreshToken) {
      console.log('No access token found, but refresh token exists. Refreshing...');
      try {
        const refreshed = await this.refreshGoogleToken(userId);
        return refreshed.accessToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        throw new Error('Failed to obtain access token. User needs to re-authenticate.');
      }
    }

    // No access token and no refresh token - user needs to re-authenticate
    throw new Error('No access token or refresh token available. User needs to reconnect their Gmail account.');
  }

  private ensureGoogleOAuthConfig() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    return { clientId, clientSecret };
  }

  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const accessToken = await this.getValidAccessToken(userId);
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
  ): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    const gmail = await this.getGmailClient(userId);
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
   * Get full message content
   * @param userId User ID
   * @param messageId Gmail message ID
   * @param format Message format: 'full', 'metadata', 'minimal', 'raw' (default: 'full')
   */
  async getMessage(
    userId: string,
    messageId: string,
    format: 'full' | 'metadata' | 'minimal' | 'raw' = 'full',
  ): Promise<any> {
    const gmail = await this.getGmailClient(userId);
    try {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format,
      });
      return data;
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to get message:', message);
      throw new Error(`Failed to get Gmail message: ${message}`);
    }
  }

  /**
   * Get only message metadata (lightweight)
   * @param userId User ID
   * @param messageId Gmail message ID
   */
  async getMessageMetadata(userId: string, messageId: string): Promise<any> {
    return this.getMessage(userId, messageId, 'metadata');
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
    concurrency: number = 10,
  ): Promise<Array<any | null>> {
    const gmail = await this.getGmailClient(userId);
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
  async getThread(userId: string, threadId: string): Promise<any> {
    const gmail = await this.getGmailClient(userId);
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

  /**
   * Store OAuth tokens in the account record
   * This should be called after OAuth callback completes
   */
  async storeOAuthTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<boolean> {
    const db = this.connection.db;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const updateQuery: any = {
      $set: {
        accessToken: accessToken,
        access_token: accessToken, // Store in both formats
        refreshToken: refreshToken,
        refresh_token: refreshToken,
        expiresAt: expiresAt,
        expires_at: expiresAt,
      },
    };

    const updated = await this.updateAccountTokens(userId, updateQuery);
    console.log('OAuth tokens stored:', updated);
    return updated;
  }

  private async updateAccountTokens(userId: string, update: any): Promise<boolean> {
    const db = this.connection.db;
    const userIdString = userId.toString();
    const filters: Record<string, any>[] = [
      { userId: userIdString, providerId: 'google' },
      { userId: userIdString, provider: 'google' },
    ];

    if (ObjectId.isValid(userIdString)) {
      const objectId = new ObjectId(userIdString);
      filters.push({ userId: objectId, providerId: 'google' });
      filters.push({ userId: objectId, provider: 'google' });
    }

    if (update.$set?.providerAccountId || update.$set?.providerAccountId === undefined) {
      filters.push({ providerAccountId: 'google', userId: userIdString });
    }

    for (const filter of filters) {
      const result = await db.collection('accounts').updateOne(filter, update);
      if (result.modifiedCount > 0 || result.matchedCount > 0) {
        return true;
      }
    }

    console.warn('Failed to update Gmail account tokens for user', userId);
    return false;
  }

  private async getOrCreateRefreshLabel(gmail: gmail_v1.Gmail): Promise<string | null> {
    try {
      const { data } = await gmail.users.labels.list({ userId: 'me' });
      const existing = data.labels?.find((label) => label.name === this.refreshLabelName);
      if (existing?.id) {
        return existing.id;
      }

      const { data: created } = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: this.refreshLabelName,
          labelListVisibility: 'labelHide',
          messageListVisibility: 'hide',
        },
      });
      return created.id || null;
    } catch (error) {
      console.warn('Error ensuring Gmail refresh label:', this.formatGoogleError(error));
      return null;
    }
  }

  private async toggleRefreshLabel(gmail: gmail_v1.Gmail, messageId?: string): Promise<void> {
    if (!messageId) {
      return;
    }

    const labelId = await this.getOrCreateRefreshLabel(gmail);
    if (!labelId) {
      return;
    }

    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: [labelId],
        },
      });
    } catch (error) {
      console.warn('Failed to toggle refresh label:', this.formatGoogleError(error));
    }
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
        return `Message #${messages.length - latest.length + index + 1}\nFrom: ${from}\nSubject: ${subject}\nBody:\n${preview}`;
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

  private encodeMessage(message: string): string {
    return Buffer.from(message, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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

  async createDraftReply(
    userId: string,
    params: {
      threadId: string;
      inReplyTo: string;
      references?: string[];
      subject?: string;
      body: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      from: string;
    },
  ): Promise<{
    id: string;
    messageId?: string;
    threadId: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject?: string;
    body?: string;
  }> {
    const gmail = await this.getGmailClient(userId);

    const headers: string[] = [
      `From: ${params.from}`,
      `To: ${params.to.join(', ')}`,
    ];

    if (params.cc?.length) {
      headers.push(`Cc: ${params.cc.join(', ')}`);
    }

    if (params.bcc?.length) {
      headers.push(`Bcc: ${params.bcc.join(', ')}`);
    }

    const subject = params.subject?.trim();
    if (subject) {
      headers.push(`Subject: ${subject}`);
    }

    headers.push(`In-Reply-To: ${params.inReplyTo}`);

    const referenceIds = [params.inReplyTo, ...(params.references || [])].filter(Boolean);
    if (referenceIds.length) {
      headers.push(`References: ${referenceIds.join(' ')}`);
    }

    headers.push(`Date: ${new Date().toUTCString()}`);
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('');

    const rawMessage = `${headers.join('\r\n')}\r\n${params.body}`;
    const encodedMessage = this.encodeMessage(rawMessage);

    try {
      const { data: draft } = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
            threadId: params.threadId,
          },
        },
      });
      await this.toggleRefreshLabel(gmail, draft.message?.id ?? undefined);
      if (!draft.id) {
        throw new Error('Gmail draft creation did not return an ID.');
      }
      return {
        id: draft.id,
        messageId: draft.message?.id,
        threadId: draft.message?.threadId || params.threadId,
        to: params.to,
        cc: params.cc || [],
        bcc: params.bcc || [],
        subject,
        body: params.body,
      };
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to create draft:', message);
      throw new Error(`Failed to create Gmail draft: ${message}`);
    }
  }

  /**
   * Get Gmail profile (includes historyId)
   * @param userId User ID
   */
  async getProfile(userId: string): Promise<{ historyId: string; emailAddress: string }> {
    const gmail = await this.getGmailClient(userId);
    try {
      const { data } = await gmail.users.getProfile({ userId: 'me' });
      if (!data.historyId || !data.emailAddress) {
        throw new Error('Incomplete Gmail profile response.');
      }
      return {
        historyId: data.historyId,
        emailAddress: data.emailAddress,
      };
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to get profile:', message);
      throw new Error(`Failed to get Gmail profile: ${message}`);
    }
  }

  /**
   * Get Gmail history (for incremental sync)
   * @param userId User ID
   * @param historyId Gmail history ID
   * @param maxResults Maximum number of results (default: 100)
   */
  async getHistory(
    userId: string,
    historyId: string,
    maxResults: number = 100,
  ): Promise<any> {
    const gmail = await this.getGmailClient(userId);
    try {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        maxResults,
        historyTypes: ['messageAdded', 'messageDeleted'],
      });
      return data;
    } catch (error) {
      const message = this.formatGoogleError(error);
      console.error('Failed to get history:', message);
      throw new Error(`Failed to get Gmail history: ${message}`);
    }
  }
}


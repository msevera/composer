import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';

@Injectable()
export class GmailService {
  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
  ) { }
  private readonly refreshLabelName = this.configService.get('GMAIL_REFRESH_LABEL') || 'SmailTempRefresh';

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

    // Log account structure for debugging
    if (account) {
      console.log('Account found, fields:', Object.keys(account));
      console.log('Access token present:', !!(account.accessToken || account.access_token));
      console.log('Refresh token present:', !!(account.refreshToken || account.refresh_token));
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
    const accessToken = await this.getValidAccessToken(userId);

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    if (query) {
      params.append('q', query);
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list messages:', response.status, errorText);
      throw new Error(`Failed to list Gmail messages: ${response.status}`);
    }

    return response.json();
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
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get message:', response.status, errorText);
      throw new Error(`Failed to get Gmail message: ${response.status}`);
    }

    return response.json();
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
    const accessToken = await this.getValidAccessToken(userId);
    const results: Array<any | null> = new Array(messageIds.length).fill(null);

    // Process messages in batches to respect concurrency limit
    for (let i = 0; i < messageIds.length; i += concurrency) {
      const batch = messageIds.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (messageId) => {
        try {
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to get message ${messageId}:`, response.status, errorText);
            return null;
          }

          return response.json();
        } catch (error) {
          console.error(`Error fetching message ${messageId}:`, error);
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
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get thread:', response.status, errorText);
      throw new Error(`Failed to get Gmail thread: ${response.status}`);
    }

    return response.json();
  }

  async getCalendarEvents(userId: string, timeMin?: string, timeMax?: string) {
    const accessToken = await this.getValidAccessToken(userId);

    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (timeMin) params.append('timeMin', timeMin);
    if (timeMax) params.append('timeMax', timeMax);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    return response.json();
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

  private async getOrCreateRefreshLabel(accessToken: string): Promise<string | null> {
    try {
      const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!listResponse.ok) {
        console.warn('Failed to list Gmail labels');
        return null;
      }

      const labels = await listResponse.json();
      const existing = labels.labels?.find((label: any) => label.name === this.refreshLabelName);
      if (existing?.id) {
        return existing.id;
      }

      const createResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.refreshLabelName,
          labelListVisibility: 'labelHide',
          messageListVisibility: 'hide',
        }),
      });

      if (!createResponse.ok) {
        console.warn('Failed to create Gmail refresh label');
        return null;
      }

      const created = await createResponse.json();
      return created.id || null;
    } catch (error) {
      console.warn('Error ensuring Gmail refresh label:', error);
      return null;
    }
  }

  private async toggleRefreshLabel(accessToken: string, messageId?: string): Promise<void> {
    if (!messageId) {
      return;
    }

    const labelId = await this.getOrCreateRefreshLabel(accessToken);
    if (!labelId) {
      return;
    }

    const modify = async (body: Record<string, any>) => {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    try {
      await modify({ addLabelIds: [labelId] });
      await modify({ removeLabelIds: [labelId] });
    } catch (error) {
      console.warn('Failed to toggle refresh label:', error);
    }
  }

  private encodeMessage(message: string): string {
    return Buffer.from(message, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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
    const accessToken = await this.getValidAccessToken(userId);

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

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: encodedMessage,
          threadId: params.threadId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create draft:', response.status, errorText);
      throw new Error(`Failed to create Gmail draft: ${response.status}`);
    }

    const draft = await response.json();
    await this.toggleRefreshLabel(accessToken, draft.message?.id);
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
  }

  /**
   * Get Gmail profile (includes historyId)
   * @param userId User ID
   */
  async getProfile(userId: string): Promise<{ historyId: string; emailAddress: string }> {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get profile:', response.status, errorText);
      throw new Error(`Failed to get Gmail profile: ${response.status}`);
    }

    return response.json();
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
    const accessToken = await this.getValidAccessToken(userId);

    const params = new URLSearchParams({
      historyTypes: 'messageAdded,messageDeleted',
      startHistoryId: historyId,
      maxResults: maxResults.toString(),
    });

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get history:', response.status, errorText);
      throw new Error(`Failed to get Gmail history: ${response.status}`);
    }

    return response.json();
  }
}


import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ObjectId } from 'mongodb';

@Injectable()
export class NotionService {
  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
  ) {}

  async getNotionAccount(userId: string): Promise<Record<string, any> | null> {
    const db = this.connection.db;

    // Try with userId as string first
    let account = await db.collection('accounts').findOne({
      userId: userId.toString(),
      providerId: 'notion',
    });

    // If not found, try with userId as-is (might be ObjectId)
    if (!account) {
      account = await db.collection('accounts').findOne({
        userId: new ObjectId(userId),
        providerId: 'notion',
      });
    }

    // Also try with 'provider' field (some adapters use this instead of 'providerId')
    if (!account) {
      account = await db.collection('accounts').findOne({
        userId: userId.toString(),
        provider: 'notion',
      });
    }

    return account;
  }

  async refreshNotionToken(userId: string) {
    const account = await this.getNotionAccount(userId);
    if (!account) {
      throw new Error('Notion account not found');
    }

    const refreshToken = account.refreshToken || account.refresh_token;
    if (!refreshToken) {
      throw new Error('No refresh token available. User needs to re-authenticate.');
    }

    const clientId = this.configService.get('NOTION_CLIENT_ID');
    const clientSecret = this.configService.get('NOTION_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Notion OAuth credentials not configured');
    }

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
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
    const updateQuery: any = {
      $set: {
        accessToken: data.access_token,
        access_token: data.access_token,
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
    const account = await this.getNotionAccount(userId);
    if (!account) {
      throw new Error('Notion account not connected');
    }

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
          const refreshed = await this.refreshNotionToken(userId);
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
        const refreshed = await this.refreshNotionToken(userId);
        return refreshed.accessToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        throw new Error('Failed to obtain access token. User needs to re-authenticate.');
      }
    }

    // No access token and no refresh token - user needs to re-authenticate
    throw new Error('No access token or refresh token available. User needs to reconnect their Notion account.');
  }

  async disconnectNotion(userId: string): Promise<boolean> {
    const db = this.connection.db;

    const userIdString = userId.toString();
    const queries: Record<string, any>[] = [
      { userId: userIdString, providerId: 'notion' },
      { userId: userIdString, provider: 'notion' },
    ];

    if (ObjectId.isValid(userIdString)) {
      const objectId = new ObjectId(userIdString);
      queries.push({ userId: objectId, providerId: 'notion' });
      queries.push({ userId: objectId, provider: 'notion' });
    }

    for (const filter of queries) {
      const result = await db.collection('accounts').deleteOne(filter);
      if (result.deletedCount > 0) {
        return true;
      }
    }

    return false;
  }

  async storeOAuthTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<boolean> {
    const db = this.connection.db;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const userIdString = userId.toString();
    const updateResult = await db.collection('accounts').updateOne(
      {
        userId: userIdString,
        providerId: 'notion',
      },
      {
        $set: {
          accessToken,
          access_token: accessToken,
          refreshToken,
          refresh_token: refreshToken,
          expiresAt,
          expires_at: expiresAt,
        },
      },
      { upsert: true },
    );

    return updateResult.acknowledged;
  }

  private async updateAccountTokens(userId: string, updateQuery: any): Promise<boolean> {
    const db = this.connection.db;
    const userIdString = userId.toString();

    const result = await db.collection('accounts').updateOne(
      {
        $or: [
          { userId: userIdString, providerId: 'notion' },
          { userId: new ObjectId(userIdString), providerId: 'notion' },
        ],
      },
      updateQuery,
    );

    return result.acknowledged;
  }
}
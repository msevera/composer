import { Injectable, Inject } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GmailService {
  constructor(
    @Inject(getConnectionToken()) private connection: Connection,
    private configService: ConfigService,
  ) {}

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
        userId: userId,
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

    // Try to update with providerId first, then provider field
    let updateResult = await this.connection.db.collection('accounts').updateOne(
      { userId: userId.toString(), providerId: 'google' },
      updateQuery,
    );

    if (updateResult.matchedCount === 0) {
      updateResult = await this.connection.db.collection('accounts').updateOne(
        { userId: userId.toString(), provider: 'google' },
        updateQuery,
      );
    }

    console.log('Token refreshed and saved:', updateResult.modifiedCount > 0);

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

  async getGmailMessages(userId: string, maxResults: number = 10) {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail messages');
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
    
    // Find and delete the Google account
    const result = await db.collection('accounts').deleteOne({
      userId: userId.toString(),
      providerId: 'google',
    });
    
    // If not found with providerId, try with provider field
    if (result.deletedCount === 0) {
      const result2 = await db.collection('accounts').deleteOne({
        userId: userId.toString(),
        provider: 'google',
      });
      return result2.deletedCount > 0;
    }
    
    return result.deletedCount > 0;
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

    const updateQuery = {
      $set: {
        accessToken: accessToken,
        access_token: accessToken, // Store in both formats
        refreshToken: refreshToken,
        refresh_token: refreshToken,
        expiresAt: expiresAt,
        expires_at: expiresAt,
      },
    };

    // Try to update with providerId first
    let updateResult = await db.collection('accounts').updateOne(
      { userId: userId.toString(), providerId: 'google' },
      updateQuery,
    );

    if (updateResult.matchedCount === 0) {
      updateResult = await db.collection('accounts').updateOne(
        { userId: userId.toString(), provider: 'google' },
        updateQuery,
      );
    }

    console.log('OAuth tokens stored:', updateResult.modifiedCount > 0);
    return updateResult.modifiedCount > 0;
  }
}


import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

// Request is available in Node.js 18+ as a global
// We'll use the global Request type for Fetch API
declare const Request: {
  new(input: string | URL, init?: RequestInit): globalThis.Request;
};

// Request is available in Node.js 18+, but we'll use a fallback if needed
const createFetchRequest = (url: string, options: any): globalThis.Request => {
  if (typeof globalThis.Request !== 'undefined') {
    return new globalThis.Request(url, options);
  }
  // Fallback for older Node.js versions - would need undici or node-fetch
  throw new Error('Request constructor not available. Node.js 18+ required or install undici.');
};

@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  constructor(
    @Inject('BETTER_AUTH') private auth: any,
    @Inject(getConnectionToken()) private connection: Connection,
  ) { }

  async use(req: ExpressRequest, res: Response, next: NextFunction) {
    // Check if this is a Better-Auth route
    if (req.path.startsWith('/api/auth') || req.originalUrl.startsWith('/api/auth')) {
      console.log('Better-Auth middleware triggered for:', req.method, req.originalUrl);

      // Use Better-Auth's handler if available
      if (!this.auth) {
        console.error('Better-Auth instance is not available');
        return next();
      }

      if (!this.auth.handler) {
        console.error('Better-Auth handler is not available. Auth object keys:', Object.keys(this.auth || {}));
        return next();
      }

      console.log('Calling Better-Auth handler...');

      try {
        // Convert Express request to Fetch API Request
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

        // Get body for POST/PUT/PATCH requests
        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
          if (req.body) {
            body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          }
        }

        // Convert Express headers to Headers object
        const headers = new Headers();
        Object.keys(req.headers).forEach((key) => {
          const value = req.headers[key];
          if (value) {
            if (Array.isArray(value)) {
              value.forEach((v) => headers.append(key, v));
            } else {
              headers.set(key, value);
            }
          }
        });

        console.log('url', url)
        const fetchRequest = createFetchRequest(url, {
          method: req.method,
          headers: headers,
          body: body,
        });

        // Call Better-Auth handler
        const fetchResponse = await this.auth.handler(fetchRequest);

        // Clone the response so we can read it multiple times if needed
        const responseBody = await fetchResponse.text();

        console.log('responseBody', req.path, responseBody)

        // Intercept OAuth callback to capture tokens
        // Better-Auth callback URLs typically look like: /api/auth/callback/google
        if (req.path.includes('/callback/google') && fetchResponse.ok) {
          try {
            const responseData = JSON.parse(responseBody);

            console.log('OAuth callback response:', {
              hasAccessToken: !!(responseData.accessToken || responseData.access_token),
              hasRefreshToken: !!(responseData.refreshToken || responseData.refresh_token),
              keys: Object.keys(responseData),
            });

            // Check if this is a successful OAuth callback with tokens
            if (responseData.accessToken || responseData.access_token) {
              console.log('OAuth callback detected with tokens');

              // Get the session to find the user ID
              const sessionResponse = await this.auth.handler(
                new Request(`${req.protocol}://${req.get('host')}/api/auth/get-session`, {
                  method: 'GET',
                  headers: headers,
                })
              );

              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData?.user?.id) {
                  const userId = sessionData.user.id;
                  const accessToken = responseData.accessToken || responseData.access_token;
                  const refreshToken = responseData.refreshToken || responseData.refresh_token;
                  const expiresIn = responseData.expiresIn || responseData.expires_in || 3600;

                  console.log('Storing tokens for userId:', userId);
                  // Store tokens in the account record
                  await this.storeOAuthTokens(userId, accessToken, refreshToken, expiresIn);
                }
              }
            }
          } catch (error) {
            console.error('Error intercepting OAuth callback:', error);
            // Continue to send the response even if token storage fails
          }
        }

        // Convert Fetch API Response to Express response
        res.status(fetchResponse.status);

        // Copy headers
        fetchResponse.headers.forEach((value, key) => {
          // Skip content-length as Express will set it
          if (key.toLowerCase() !== 'content-length') {
            res.setHeader(key, value);
          }
        });

        // Send response body
        res.send(responseBody);
        // Don't call next() after sending response
        return;
      } catch (error) {
        console.error('Better-Auth handler error:', error);
        return next(error);
      }
    }
    next();
  }

  private async storeOAuthTokens(
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

    console.log('OAuth tokens stored in middleware:', updateResult.modifiedCount > 0);
    return updateResult.modifiedCount > 0;
  }
}


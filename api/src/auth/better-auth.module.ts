import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';

@Global()
@Module({
  providers: [
    {
      provide: 'BETTER_AUTH',
      useFactory: async (connection: Connection, configService: ConfigService) => {
        // Use the existing Mongoose connection to get the native MongoDB database
        const db = connection.db;

        const auth = betterAuth({
          database: mongodbAdapter(db as any, {
            usePlural: true, // Use plural collection names (users, sessions, accounts, verifications)
          }),
          emailAndPassword: {
            enabled: true,
          },
          socialProviders: {
            google: {
              clientId: configService.get('GOOGLE_CLIENT_ID') || '',
              clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || '',
              enabled: true,
              scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar.events',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
              ],
              accessType: "offline",
              prompt: "select_account consent",
            },
          },
          account: {
            accountLinking: {
              enabled: true,
              trustedProviders: ["google", "email-password"],
              allowDifferentEmails: true
            }
          },
          secret: configService.get('BETTER_AUTH_SECRET') || 'your-secret-key',
          baseURL: configService.get('BETTER_AUTH_URL') || 'http://localhost:4000',
          basePath: '/api/auth',
          trustedOrigins: [
            'http://localhost:3000',
            'http://localhost:4000',
          ],
          // Database hooks to intercept account creation and store OAuth tokens
          databaseHooks: {
            account: {
              create: {
                before: async (account) => {
                  console.log('Account created in database:', {
                    accountId: account.id,
                    providerId: account.providerId,
                    userId: account.userId,
                    hasAccessToken: !!account.accessToken,
                    hasRefreshToken: !!account.refreshToken,
                    expiresAt: account.accessTokenExpiresAt,
                  });
                  // Log the full account object to see what Better-Auth actually stores
                  console.log('Full account object:', JSON.stringify(account, null, 2));
                },
              },
            },
          },
        });

        return auth;
      },
      inject: [getConnectionToken(), ConfigService],
    },
  ],
  exports: ['BETTER_AUTH'],
})
export class BetterAuthModule { }


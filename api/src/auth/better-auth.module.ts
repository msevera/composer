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
          secret: configService.get('BETTER_AUTH_SECRET') || 'your-secret-key',
          baseURL: configService.get('BETTER_AUTH_URL') || 'http://localhost:4000',
          basePath: '/api/auth',
          trustedOrigins: [
            'http://localhost:3000',
            'http://localhost:4000',
          ],
        });

        return auth;
      },
      inject: [getConnectionToken(), ConfigService],
    },
  ],
  exports: ['BETTER_AUTH'],
})
export class BetterAuthModule {}


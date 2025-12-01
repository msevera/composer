import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { GmailModule } from './gmail/gmail.module';
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from 'better-auth';
import { Connection } from 'mongoose';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { CompositionModule } from './composition/composition.module';
import { bearer } from "better-auth/plugins";
import * as jose from 'jose';
import { listAccountsPlugin } from './auth/list-accounts.plugin';
import { AppController } from './app.controller';
import { SegmentModule } from './segment/segment.module';
import { SegmentService } from './segment/segment.service';



@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/composerai',
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    UserModule,
    CompositionModule,
    SegmentModule,
    AuthModule.forRootAsync({
      useFactory: (connection: Connection, configService: ConfigService, segmentService: SegmentService) => {
        const webOrigins = (configService.get<string>('WEB_ORIGINS') || '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

        const auth = betterAuth({
          plugins: [bearer(), listAccountsPlugin()],
          database: mongodbAdapter(connection.db as any, {
            usePlural: true,
          }),
          socialProviders: {
            google: {
              clientId: configService.get('GOOGLE_CLIENT_ID') || '',
              clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || '',
              enabled: true,
              accessType: "offline",
              prompt: "select_account consent",
            },
          },
          databaseHooks: {
            account: {
              create: {
                before: async (account) => {
                  const user = jose.decodeJwt(account.idToken)
                  return { data: { ...account, email: user.email } };
                },
                after: async (account) => {
                  // Track Gmail account connection if it's a Google account
                  if (account && account.providerId === 'google' && account.userId) {
                    try {
                      // Get email from the database since it's stored there
                      const accountDoc = await connection.db.collection('accounts').findOne({ id: account.id });
                      const email = (accountDoc as any)?.email;
                      
                      segmentService.track(account.userId.toString(), 'Gmail Account Connected', {
                        email: email,
                        accountId: account.accountId,
                        providerId: account.providerId,
                      });
                    } catch (error) {
                      console.error('Failed to track Gmail connection:', error);
                    }
                  }
                },
              },
            },
            user: {
              create: {
                before: async (user) => {
                  return {
                    data: {
                      ...user,
                      maxDraftsAllowed: 50,
                      draftsUsed: 0,
                      onboardingCompleted: false,
                      sendProductUpdates: false
                    }
                  };
                },
                after: async (user) => {
                  // Track new user account creation
                  if (user && user.id) {
                    try {
                      segmentService.track(user.id.toString(), 'User Account Created', {
                        email: user.email,
                        name: user.name,
                      });
                      // Identify the user
                      segmentService.identify(user.id.toString(), {
                        email: user.email,
                        name: user.name,
                      });
                    } catch (error) {
                      console.error('Failed to track user creation:', error);
                    }
                  }
                },
              },
            },
          },
          account: {
            accountLinking: {
              enabled: true,
              trustedProviders: ["google"],
              allowDifferentEmails: true,
              allowUnlinkingAll: true
            },
            additionalFields: {
              email: {
                type: "string",
              }
            }
          },
          user: {
            additionalFields: {
              maxDraftsAllowed: {
                type: "number",
              },
              draftsUsed: {
                type: "number",
              },
              onboardingCompleted: {
                type: "boolean",
              },
              sendProductUpdates: {
                type: "boolean",
              },
            }
          },
          secret: configService.get('BETTER_AUTH_SECRET'),
          baseURL: configService.get('BETTER_AUTH_URL'),
          basePath: '/api/auth',
          trustedOrigins: [
            ...webOrigins
          ],
        });

        return {
          auth
        };
      },
      inject: [getConnectionToken(), ConfigService, SegmentService],
    }),
    GmailModule,
  ]
})
export class AppModule { }


import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { UserModule } from './user/user.module';
import { GmailModule } from './gmail/gmail.module';
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { betterAuth } from 'better-auth';
import { Connection } from 'mongoose';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { IndexingModule } from './indexing/indexing.module';
import { CompositionModule } from './composition/composition.module';
import { bearer } from "better-auth/plugins";
import * as jose from 'jose';
import { listAccountsPlugin } from './auth/list-accounts.plugin';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/composerai',
      }),
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    UserModule,
    IndexingModule,
    CompositionModule,
    AuthModule.forRootAsync({
      useFactory: (connection: Connection, configService: ConfigService) => {
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

              },
            }
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
          secret: configService.get('BETTER_AUTH_SECRET') || 'your-secret-key',
          baseURL: configService.get('BETTER_AUTH_URL') || 'http://localhost:4000',
          basePath: '/api/auth',
          trustedOrigins: [
            'http://localhost:3000',
            'http://localhost:4000',
            'http://localhost:5173',
            // configService.get('CHROME_EXTENSION_ORIGINS') || '',
          ],
        });  

        return {
          auth
        };
      },
      inject: [getConnectionToken(), ConfigService],
    }),
    GmailModule,
  ]
})
export class AppModule { }


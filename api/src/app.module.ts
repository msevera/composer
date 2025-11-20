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
import { NotionModule } from './notion/notion.module';
import { bearer, jwt } from "better-auth/plugins";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smail',
      }),
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          // password: configService.get('REDIS_PASSWORD'),
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
        return {
          auth: betterAuth({
            plugins: [bearer(), jwt()],
            advanced: {
              defaultCookieAttributes: {
                sameSite: "none",
                secure: true,
               // partitioned: true // newer browser standards
              }
            },
            database: mongodbAdapter(connection.db as any, {
              usePlural: true,
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
              notion: {
                clientId: configService.get('NOTION_CLIENT_ID') || '',
                clientSecret: configService.get('NOTION_CLIENT_SECRET') || ''
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
              'http://localhost:5173',
              configService.get('CHROME_EXTENSION_ORIGINS') || '',
            ],
          }),
        };
      },
      inject: [getConnectionToken(), ConfigService],
    }),
    GmailModule,
    NotionModule,
  ]
})
export class AppModule { }


import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Don't worry, the library will automatically re-add the default body parsers.
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 4000;

  // Enable cookie parser for Better-Auth
  app.use(cookieParser());

  const extensionOrigins = (configService.get<string>('CHROME_EXTENSION_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:4000',
    'https://mail.google.com',
    ...extensionOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      console.log('origin', origin);
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    exposedHeaders: ['set-auth-token'],
  });

  await app.listen(port);
  console.log(`🚀 API Server running on http://localhost:${port}/graphql`);
}
bootstrap();


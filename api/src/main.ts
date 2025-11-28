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
  const port = configService.get('PORT') || 8080;

  // Enable cookie parser for Better-Auth
  app.use(cookieParser());

  const extensionOrigins = (configService.get<string>('CHROME_EXTENSION_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const webOrigins = (configService.get<string>('WEB_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    'https://mail.google.com',
    ...webOrigins,
    ...extensionOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
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


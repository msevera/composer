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
  
  // Enable CORS for Next.js frontend
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(port);
  console.log(`🚀 API Server running on http://localhost:${port}/graphql`);
}
bootstrap();


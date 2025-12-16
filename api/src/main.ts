import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as net from 'net';
const cookieParser = require('cookie-parser');

// Store app instance for cleanup
let appInstance: INestApplication | null = null;
let isShuttingDown = false;

async function cleanup() {
  if (isShuttingDown || !appInstance) return;
  isShuttingDown = true;
  
  try {
    // Get MongoDB connection and close it directly
    // This is a fallback for watch mode restarts where NestJS hooks might not fire
    const connection = appInstance.get<Connection>(getConnectionToken());
    if (connection && connection.readyState === 1) {
      console.log('4444Closing MongoDB connection from process signal handler...');
      await Promise.race([
        connection.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]).catch((error) => {
        if (error.message !== 'Timeout') {
          console.error('Error closing MongoDB connection:', error);
        }
      });
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    // Connection might not be available yet, ignore
    console.debug('Could not access MongoDB connection for cleanup:', error.message);
  }
  
  try {
    // Close the HTTP server first, then the app
    const httpServer = appInstance.getHttpServer();
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    await appInstance.close();
  } catch (error) {
    // Ignore errors if app is already closed
  }
}

// Handle process signals (works even during watch mode restarts)
// These act as a safety net when NestJS shutdown hooks don't fire
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  await cleanup();
  process.exit(0);
});

// Check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

// Wait for port to become available (with timeout)
async function waitForPort(port: number, maxWaitMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 200; // Check every 200ms

  while (Date.now() - startTime < maxWaitMs) {
    if (await isPortAvailable(port)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Don't worry, the library will automatically re-add the default body parsers.
    bodyParser: false,
  });

  appInstance = app;

  // Enable shutdown hooks to gracefully close connections
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 8080;

  // Wait for port to be available (important for watch mode restarts)
  console.log(`Checking if port ${port} is available...`);
  const portAvailable = await waitForPort(port, 10000);
  
  if (!portAvailable) {
    console.warn(`Port ${port} is still in use. This might be from a previous instance.`);
    console.warn('Attempting to start anyway - if it fails, wait a moment and try again.');
  } else {
    console.log(`Port ${port} is available`);
  }

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

  try {
    await app.listen(port);
    console.log(`🚀 API Server running on http://localhost:${port}/graphql`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${port} is already in use.`);
      console.error('This usually happens during watch mode restarts when the previous instance hasn\'t fully closed.');
      console.error('Solutions:');
      console.error('  1. Wait a few seconds and the port should be released');
      console.error('  2. Manually kill the process: lsof -ti:' + port + ' | xargs kill -9');
      console.error('  3. Use a different port by setting PORT environment variable\n');
      process.exit(1);
    }
    throw error;
  }
}
bootstrap();


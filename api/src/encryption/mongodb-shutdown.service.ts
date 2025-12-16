import { Injectable, Logger, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongodbShutdownService implements OnApplicationShutdown, OnModuleDestroy {
  private readonly logger = new Logger(MongodbShutdownService.name);
  private isClosing = false;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleDestroy() {
    // Backup cleanup in case OnApplicationShutdown doesn't fire (e.g., watch mode)
    await this.closeConnection('module destroy');
  }

  async onApplicationShutdown(signal?: string) {
    await this.closeConnection(`application shutdown (signal: ${signal || 'unknown'})`);
  }

  private async closeConnection(context: string) {
    if (this.isClosing) {
      this.logger.debug(`Connection already closing, skipping (context: ${context})`);
      return;
    }

    this.isClosing = true;
    this.logger.log(`Closing MongoDB connection (context: ${context})`);
    
    try {
      if (this.connection.readyState === 1) { // 1 = connected
        await this.connection.close();
        this.logger.log('MongoDB connection closed successfully');
      } else {
        this.logger.debug(`MongoDB connection already closed (readyState: ${this.connection.readyState})`);
      }
    } catch (error) {
      this.logger.error('Error closing MongoDB connection:', error);
    } finally {
      this.isClosing = false;
    }
  }
}


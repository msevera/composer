import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Analytics } from '@segment/analytics-node';

@Injectable()
export class SegmentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SegmentService.name);
  private analytics: Analytics | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const writeKey = this.configService.get<string>('SEGMENT_WRITE_KEY');
    if (!writeKey) {
      this.logger.warn('SEGMENT_WRITE_KEY not configured. Segment tracking will be disabled.');
      return;
    }

    this.analytics = new Analytics({
      writeKey,
      maxEventsInBatch: 20,
      flushInterval: 10000, // Flush every 10 seconds
    });

    this.logger.log('Segment analytics initialized');
  }

  onModuleDestroy() {
    if (this.analytics) {
      this.analytics.closeAndFlush();
      this.logger.log('Segment analytics closed');
    }
  }

  /**
   * Track an event for a user
   */
  track(userId: string, event: string, properties?: Record<string, any>): void {
    if (!this.analytics) {
      this.logger.debug(`Segment not initialized. Skipping event: ${event}`);
      return;
    }

    try {
      this.analytics.track({
        userId,
        event,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
        },
      });
      this.logger.debug(`Tracked event: ${event} for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to track event ${event}:`, error);
    }
  }

  /**
   * Identify a user with traits
   */
  identify(userId: string, traits?: Record<string, any>): void {
    if (!this.analytics) {
      this.logger.debug(`Segment not initialized. Skipping identify for user: ${userId}`);
      return;
    }

    try {
      this.analytics.identify({
        userId,
        traits: {
          ...traits,
        },
      });
      this.logger.debug(`Identified user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to identify user ${userId}:`, error);
    }
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    if (!this.analytics) {
      return;
    }

    try {
      await this.analytics.flush();
      this.logger.debug('Segment events flushed');
    } catch (error) {
      this.logger.error('Failed to flush Segment events:', error);
      throw error;
    }
  }
}


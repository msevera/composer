import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const EMAIL_INDEXING_QUEUE = 'email-indexing';

@Injectable()
export class EmailIndexingQueue {
  constructor(
    @InjectQueue(EMAIL_INDEXING_QUEUE) private queue: Queue,
  ) {}

  async addIndexingJob(userId: string): Promise<void> {
    await this.queue.add('index-initial-emails', {
      userId,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    });
  }

  async getJobStatus(userId: string): Promise<any> {
    const jobs = await this.queue.getJobs(['active', 'waiting', 'delayed']);
    const userJob = jobs.find(job => job.data.userId === userId);
    return userJob ? {
      id: userJob.id,
      state: await userJob.getState(),
      progress: userJob.progress,
    } : null;
  }
}


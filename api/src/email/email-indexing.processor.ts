import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/schemas/user.schema';
import { EmailIndexingService } from './email-indexing.service';
import { EMAIL_INDEXING_QUEUE } from './email-indexing.queue';

@Processor(EMAIL_INDEXING_QUEUE)
@Injectable()
export class EmailIndexingProcessor extends WorkerHost {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailIndexingService: EmailIndexingService,
  ) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<{ indexed: number; errors: number }> {
    const { userId } = job.data;

    console.log(`Processing email indexing job for user ${userId}, job ID: ${job.id}`);

    // Find user document using the service method
    const user = await this.emailIndexingService.findUserDocument(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Check if indexing is already in progress (double-check)
    if (user.isEmailIndexingInProgress) {
      console.log(`Indexing already in progress for user ${userId}, skipping job`);
      return { indexed: 0, errors: 0 };
    }

    // Mark indexing as in progress
    user.isEmailIndexingInProgress = true;
    user.emailIndexingStartedAt = new Date();
    await user.save();

    try {
      // Execute the actual indexing
      const result = await this.emailIndexingService['indexInitialEmailsSync'](userId);

      // Clear the in-progress flag
      const userToUpdate = await this.userModel.findById(user._id).exec();
      if (userToUpdate) {
        userToUpdate.isEmailIndexingInProgress = false;
        await userToUpdate.save();
      }

      console.log(`Email indexing completed for user ${userId}: ${result.indexed} indexed, ${result.errors} errors`);
      return result;
    } catch (error) {
      // Clear the in-progress flag on error
      const userToUpdate = await this.userModel.findById(user._id).exec();
      if (userToUpdate) {
        userToUpdate.isEmailIndexingInProgress = false;
        await userToUpdate.save();
      }

      console.error(`Email indexing failed for user ${userId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Email indexing job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Email indexing job ${job.id} failed:`, error);
  }
}


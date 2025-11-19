import { Resolver, Query, Mutation, Context, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EmailService } from './email.service';
import { EmailIndexingService } from './email-indexing.service';
import { EmailIndexingQueue } from './email-indexing.queue';
import { EmailDraft } from './entities/email-draft.entity';
import { CreateDraftInput } from './dto/create-draft.input';
import { GmailService } from '../gmail/gmail.service';

@Resolver()
export class EmailResolver {
  constructor(
    private emailService: EmailService,
    private emailIndexingService: EmailIndexingService,
    private emailIndexingQueue: EmailIndexingQueue,
    private gmailService: GmailService,
  ) {}

  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async hasInitialIndexingCompleted(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    return this.emailIndexingService.hasInitialIndexingCompleted(userId.toString());
  }

  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async isIndexingInProgress(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    return this.emailIndexingService.isIndexingInProgress(userId.toString());
  }

  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async indexInitialEmails(@Context() context: any): Promise<string> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    // Check if indexing can be queued (not in progress, not already completed)
    const canQueue = await this.emailIndexingService.queueInitialIndexing(userId.toString());
    
    if (!canQueue) {
      // Check if already in progress
      const isInProgress = await this.emailIndexingService.isIndexingInProgress(userId.toString());
      if (isInProgress) {
        throw new Error('Email indexing is already in progress');
      }
      // Otherwise, already completed
      return 'Initial indexing already completed';
    }

    // Queue the indexing job
    await this.emailIndexingQueue.addIndexingJob(userId.toString());
    
    return 'Email indexing job queued successfully';
  }

  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async indexEmail(
    @Context() context: any,
    @Args('messageId') messageId: string,
  ): Promise<string> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    await this.emailIndexingService.indexMessageOnDemand(userId.toString(), messageId);
    return 'Email indexed successfully';
  }

  @Mutation(() => String)
  @UseGuards(AuthGuard)
  async sendQuickNote(
    @Context() context: any,
    @Args('content') content: string,
  ): Promise<string> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Content cannot be empty');
    }
    console.log(`[QuickNote] user=${userId} content="${trimmed.substring(0, 120)}"`);
    return 'Note sent';
  }

  @Mutation(() => EmailDraft)
  @UseGuards(AuthGuard)
  async createDraftReply(
    @Context() context: any,
    @Args('input', { type: () => CreateDraftInput }) input: CreateDraftInput,
  ): Promise<EmailDraft> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const fromAddress = user.email || user.emailAddress || user.profile?.email;
    if (!fromAddress) {
      throw new Error('User email address not available');
    }

    if (!input.to || input.to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    const originalEmail = await this.emailService.getEmailByMessageId(userId.toString(), input.messageId);
    const threadId = originalEmail?.threadId || input.threadId;
    if (!threadId) {
      throw new Error('Thread ID is required to create a draft reply');
    }

    if (originalEmail && originalEmail.threadId !== input.threadId) {
      throw new Error('Provided thread does not match the original email');
    }

    const subject =
      input.subject ||
      (originalEmail?.subject
        ? originalEmail.subject.startsWith('Re:')
          ? originalEmail.subject
          : `Re: ${originalEmail.subject}`
        : undefined);

    const draft = await this.gmailService.createDraftReply(userId.toString(), {
      threadId,
      inReplyTo: input.messageId,
      references: originalEmail ? [originalEmail.messageId] : undefined,
      subject,
      body: input.body,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      from: fromAddress,
    });

    return {
      id: draft.id,
      messageId: draft.messageId,
      threadId: draft.threadId,
      subject: draft.subject,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      body: draft.body,
    };
  }
}


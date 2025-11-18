import { Resolver, Query, Mutation, Context, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EmailService } from './email.service';
import { EmailIndexingService } from './email-indexing.service';
import { EmailIndexingQueue } from './email-indexing.queue';
import { Email } from './entities/email.entity';
import { EmailThread } from './entities/email-thread.entity';
import { EmailContent } from './entities/email-content.entity';
import { EmailPagination, EmailThreadPagination } from './entities/email-pagination.entity';

@Resolver()
export class EmailResolver {
  constructor(
    private emailService: EmailService,
    private emailIndexingService: EmailIndexingService,
    private emailIndexingQueue: EmailIndexingQueue,
  ) {}

  @Query(() => EmailPagination)
  @UseGuards(AuthGuard)
  async emails(
    @Context() context: any,
    @Args('cursor', { nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit?: number,
    @Args('threadId', { nullable: true }) threadId?: string,
    @Args('isRead', { nullable: true }) isRead?: boolean,
  ): Promise<EmailPagination> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const result = await this.emailService.getEmails(userId.toString(), cursor, limit, {
      threadId,
      isRead,
    });

    return {
      emails: result.emails.map((email) => ({
        id: email._id.toString(),
        messageId: email.messageId,
        threadId: email.threadId,
        userId: email.userId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        snippet: email.snippet,
        date: email.date,
        labels: email.labels,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        attachmentCount: email.attachmentCount,
        indexedAt: email.indexedAt,
        bodyFetched: email.bodyFetched,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt,
      })),
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  @Query(() => EmailThreadPagination)
  @UseGuards(AuthGuard)
  async emailThreads(
    @Context() context: any,
    @Args('cursor', { nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit?: number,
  ): Promise<EmailThreadPagination> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const result = await this.emailService.getEmailThreads(userId.toString(), cursor, limit);

    return {
      threads: result.threads.map((thread) => ({
        threadId: thread.threadId,
        userId: thread.emails[0]?.userId || userId.toString(),
        emails: thread.emails.map((email) => ({
          id: email._id.toString(),
          messageId: email.messageId,
          threadId: email.threadId,
          userId: email.userId,
          subject: email.subject,
          from: email.from,
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
          replyTo: email.replyTo,
          snippet: email.snippet,
          date: email.date,
          labels: email.labels,
          isRead: email.isRead,
          hasAttachments: email.hasAttachments,
          attachmentCount: email.attachmentCount,
          indexedAt: email.indexedAt,
          bodyFetched: email.bodyFetched,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
        })),
        emailCount: thread.emailCount,
        subject: thread.subject,
        lastEmailDate: thread.lastEmailDate,
        isRead: thread.isRead,
      })),
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    };
  }

  @Query(() => [Email])
  @UseGuards(AuthGuard)
  async emailThread(
    @Context() context: any,
    @Args('threadId') threadId: string,
  ): Promise<Email[]> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    const emails = await this.emailService.getThread(userId.toString(), threadId);

    return emails.map((email) => ({
      id: email._id.toString(),
      messageId: email.messageId,
      threadId: email.threadId,
      userId: email.userId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo,
      snippet: email.snippet,
      date: email.date,
      labels: email.labels,
      isRead: email.isRead,
      hasAttachments: email.hasAttachments,
      attachmentCount: email.attachmentCount,
      indexedAt: email.indexedAt,
      bodyFetched: email.bodyFetched,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
    }));
  }

  @Query(() => EmailContent)
  @UseGuards(AuthGuard)
  async emailContent(
    @Context() context: any,
    @Args('messageId') messageId: string,
  ): Promise<EmailContent> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    // Check if email is indexed, if not, index it on demand
    const email = await this.emailService.getEmailByMessageId(userId.toString(), messageId);
    if (!email || !email.bodyFetched) {
      await this.emailIndexingService.indexMessageOnDemand(userId.toString(), messageId);
    }

    const content = await this.emailService.getEmailContent(userId.toString(), messageId);

    return {
      messageId: content.messageId,
      threadId: content.threadId,
      userId: content.userId,
      subject: content.subject,
      from: content.from,
      to: content.to,
      cc: content.cc,
      bcc: content.bcc,
      replyTo: content.replyTo,
      date: content.date,
      textBody: content.textBody,
      htmlBody: content.htmlBody,
      attachments: content.attachments.map((att) => ({
        attachmentId: att.attachmentId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      })),
      labels: content.labels,
    };
  }

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
}


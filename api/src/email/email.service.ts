import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Email, EmailDocument } from './schemas/email.schema';
import { GmailService } from '../gmail/gmail.service';

@Injectable()
export class EmailService {
  constructor(
    @InjectModel(Email.name) private emailModel: Model<EmailDocument>,
    @Inject(getConnectionToken()) private connection: Connection,
    private gmailService: GmailService,
  ) {}

  /**
   * Get emails with cursor-based pagination
   */
  async getEmails(
    userId: string,
    cursor?: string,
    limit: number = 50,
    filters?: { threadId?: string; isRead?: boolean },
  ): Promise<{
    emails: EmailDocument[];
    nextCursor?: string;
    prevCursor?: string;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const query: any = { userId };

    if (filters?.threadId) {
      query.threadId = filters.threadId;
    }

    if (filters?.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    // Decode cursor (simple base64 encoding of date + messageId)
    let skip = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        const [dateStr, messageId] = decoded.split('|');
        if (dateStr && messageId) {
          // Find position of this message
          const cursorDate = new Date(dateStr);
          const cursorEmail = await this.emailModel.findOne({ messageId, userId });
          if (cursorEmail) {
            // Count emails before this one
            const countQuery = { ...query, $or: [
              { date: { $lt: cursorDate } },
              { date: cursorDate, _id: { $lt: cursorEmail._id } },
            ]};
            skip = await this.emailModel.countDocuments(countQuery);
          }
        }
      } catch (error) {
        console.error('Error decoding cursor:', error);
      }
    }

    // Get emails (ordered by date descending)
    const emails = await this.emailModel
      .find(query)
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(limit + 1) // Fetch one extra to check if there's more
      .exec();

    const hasNext = emails.length > limit;
    const resultEmails = hasNext ? emails.slice(0, limit) : emails;

    // Generate cursors
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (hasNext && resultEmails.length > 0) {
      const lastEmail = resultEmails[resultEmails.length - 1];
      nextCursor = Buffer.from(`${lastEmail.date.toISOString()}|${lastEmail.messageId}`).toString('base64');
    }

    if (skip > 0) {
      const firstEmail = resultEmails[0];
      if (firstEmail) {
        // For previous cursor, we need to go back
        const prevSkip = Math.max(0, skip - limit);
        const prevEmails = await this.emailModel
          .find(query)
          .sort({ date: -1, _id: -1 })
          .skip(prevSkip)
          .limit(1)
          .exec();
        
        if (prevEmails.length > 0) {
          const prevEmail = prevEmails[0];
          prevCursor = Buffer.from(`${prevEmail.date.toISOString()}|${prevEmail.messageId}`).toString('base64');
        }
      }
    }

    return {
      emails: resultEmails,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev: skip > 0,
    };
  }

  /**
   * Get email threads (grouped by threadId)
   */
  async getEmailThreads(
    userId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<{
    threads: Array<{
      threadId: string;
      emails: EmailDocument[];
      emailCount: number;
      subject?: string;
      lastEmailDate: Date;
      isRead: boolean;
    }>;
    nextCursor?: string;
    prevCursor?: string;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    // Get unique thread IDs with their latest email date
    const threadAggregation = await this.emailModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$threadId',
          lastEmailDate: { $max: '$date' },
          emailCount: { $sum: 1 },
          isRead: { $min: { $cond: ['$isRead', 0, 1] } }, // 0 if all read, 1 if any unread
        },
      },
      { $sort: { lastEmailDate: -1 } },
    ]);

    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        const cursorDate = new Date(decoded);
        startIndex = threadAggregation.findIndex(t => t.lastEmailDate <= cursorDate);
        if (startIndex === -1) startIndex = 0;
      } catch (error) {
        console.error('Error decoding thread cursor:', error);
      }
    }

    const threadsData = threadAggregation.slice(startIndex, startIndex + limit + 1);
    const hasNext = threadsData.length > limit;
    const resultThreads = hasNext ? threadsData.slice(0, limit) : threadsData;

    // Get emails for each thread
    const threads = await Promise.all(
      resultThreads.map(async (threadData) => {
        const emails = await this.emailModel
          .find({ userId, threadId: threadData._id })
          .sort({ date: -1 })
          .exec();

        const subject = emails[0]?.subject;
        const isRead = threadData.isRead === 0;

        return {
          threadId: threadData._id,
          emails,
          emailCount: threadData.emailCount,
          subject,
          lastEmailDate: threadData.lastEmailDate,
          isRead,
        };
      }),
    );

    // Generate cursors
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (hasNext && resultThreads.length > 0) {
      const lastThread = resultThreads[resultThreads.length - 1];
      nextCursor = Buffer.from(lastThread.lastEmailDate.toISOString()).toString('base64');
    }

    if (startIndex > 0) {
      const prevThreads = threadAggregation.slice(Math.max(0, startIndex - limit), startIndex);
      if (prevThreads.length > 0) {
        const prevThread = prevThreads[prevThreads.length - 1];
        prevCursor = Buffer.from(prevThread.lastEmailDate.toISOString()).toString('base64');
      }
    }

    return {
      threads,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev: startIndex > 0,
    };
  }

  /**
   * Get all emails in a thread
   */
  async getThread(userId: string, threadId: string): Promise<EmailDocument[]> {
    return this.emailModel
      .find({ userId, threadId })
      .sort({ date: 1 }) // Oldest first for conversation flow
      .exec();
  }

  /**
   * Get email by messageId
   */
  async getEmailByMessageId(userId: string, messageId: string): Promise<EmailDocument | null> {
    return this.emailModel.findOne({ userId, messageId }).exec();
  }

  /**
   * Fetch and return full email content from Gmail API
   */
  async getEmailContent(userId: string, messageId: string): Promise<any> {
    const messageData = await this.gmailService.getMessage(userId, messageId);

    // Extract headers
    const headers = messageData.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    // Extract body
    const bodyText = this.extractBodyText(messageData.payload);
    const bodyHtml = this.extractBodyHtml(messageData.payload);

    // Extract attachments
    const attachments = this.extractAttachments(messageData.payload);

    return {
      messageId: messageData.id,
      threadId: messageData.threadId,
      userId,
      subject: getHeader('subject'),
      from: getHeader('from'),
      to: (getHeader('to') || '').split(',').map((e: string) => e.trim()).filter(Boolean),
      cc: (getHeader('cc') || '').split(',').map((e: string) => e.trim()).filter(Boolean),
      bcc: (getHeader('bcc') || '').split(',').map((e: string) => e.trim()).filter(Boolean),
      replyTo: getHeader('reply-to'),
      date: new Date(messageData.internalDate ? parseInt(messageData.internalDate) : Date.now()),
      textBody: bodyText,
      htmlBody: bodyHtml,
      attachments,
      labels: messageData.labelIds || [],
    };
  }

  /**
   * Extract plain text body from Gmail message payload
   */
  private extractBodyText(payload: any): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          const text = this.extractBodyFromParts(part.parts, 'text/plain');
          if (text) return text;
        }
      }
    }

    return '';
  }

  /**
   * Extract HTML body from Gmail message payload
   */
  private extractBodyHtml(payload: any): string {
    if (!payload) return '';

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          const html = this.extractBodyFromParts(part.parts, 'text/html');
          if (html) return html;
        }
      }
    }

    return '';
  }

  /**
   * Recursively extract body from message parts
   */
  private extractBodyFromParts(parts: any[], mimeType: string): string {
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        const text = this.extractBodyFromParts(part.parts, mimeType);
        if (text) return text;
      }
    }
    return '';
  }

  /**
   * Extract attachments from Gmail message payload
   */
  private extractAttachments(payload: any): Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    const attachments: Array<{
      attachmentId: string;
      filename: string;
      mimeType: string;
      size: number;
    }> = [];

    if (!payload || !payload.parts) return attachments;

    const extractFromParts = (parts: any[]) => {
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            attachmentId: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
          });
        }
        if (part.parts) {
          extractFromParts(part.parts);
        }
      }
    };

    extractFromParts(payload.parts);
    return attachments;
  }
}


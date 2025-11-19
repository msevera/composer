import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GmailEmbedding, GmailEmbeddingDocument } from '../schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateDocument } from '../schemas/gmail-sync-state.schema';
import { EmbeddingService } from './embedding.service';
import { GmailService } from '../../gmail/gmail.service';
import { convert } from 'html-to-text';

@Injectable()
export class GmailIndexerService {
  constructor(
    @InjectModel(GmailEmbedding.name) private embeddingModel: Model<GmailEmbeddingDocument>,
    @InjectModel(GmailSyncState.name) private syncStateModel: Model<GmailSyncStateDocument>,
    private embeddingService: EmbeddingService,
    private gmailService: GmailService,
  ) {}

  /**
   * Initial bulk indexing (last 7 days of emails)
   */
  async indexUserEmails(userId: string): Promise<{ indexed: number; errors: number }> {
    // Update sync state to 'syncing'
    await this.syncStateModel.findOneAndUpdate(
      { userId },
      { status: 'syncing', errorMessage: null },
      { upsert: true }
    );

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const query = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;

      let indexed = 0;
      let errors = 0;
      let pageToken: string | undefined;

      do {
        const result = await this.gmailService.listMessages(userId, pageToken, 50, query);
        
        if (!result.messages || result.messages.length === 0) {
          break;
        }

        const messageIds = result.messages.map(msg => msg.id);
        const messageDataArray = await this.gmailService.getMessagesBulk(
          userId,
          messageIds,
          'full',
          10
        );

        for (const messageData of messageDataArray) {
          if (messageData) {
            try {
              await this.indexMessageWithEmbeddings(userId, messageData);
              indexed++;
            } catch (error) {
              console.error(`Error indexing message ${messageData.id}:`, error);
              errors++;
            }
          } else {
            errors++;
          }
        }

        pageToken = result.nextPageToken;
      } while (pageToken);

      // Get current historyId from Gmail profile
      let historyId: string | undefined;
      try {
        const profile = await this.gmailService.getProfile(userId);
        historyId = profile.historyId;
      } catch (error) {
        console.error('Error getting Gmail profile for historyId:', error);
      }

      // Update sync state
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        {
          status: 'completed',
          lastSyncedAt: new Date(),
          totalEmailsIndexed: indexed,
          historyId,
        }
      );

      return { indexed, errors };
    } catch (error) {
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { status: 'error', errorMessage: error.message }
      );
      throw error;
    }
  }

  /**
   * Incremental sync using Gmail history API
   */
  async incrementalSync(userId: string): Promise<void> {
    const syncState = await this.syncStateModel.findOne({ userId });
    if (!syncState?.historyId) {
      console.log('No historyId found, skipping incremental sync');
      return;
    }

    try {
      // Use Gmail history API to get changes
      const history = await this.gmailService.getHistory(userId, syncState.historyId);
      
      if (!history || !history.history) {
        return;
      }

      // Process added messages
      for (const historyItem of history.history) {
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            const messageData = await this.gmailService.getMessage(userId, added.message.id);
            await this.indexMessageWithEmbeddings(userId, messageData);
          }
        }

        // Process deleted messages
        if (historyItem.messagesDeleted) {
          for (const deleted of historyItem.messagesDeleted) {
            await this.embeddingModel.deleteMany({
              userId,
              emailId: deleted.message.id,
            });
          }
        }
      }

      // Update historyId
      await this.syncStateModel.findOneAndUpdate(
        { userId },
        { historyId: history.historyId, lastSyncedAt: new Date() }
      );
    } catch (error) {
      console.error('Error in incremental sync:', error);
      throw error;
    }
  }

  /**
   * Index single message with embeddings
   */
  private async indexMessageWithEmbeddings(userId: string, messageData: any): Promise<void> {
    const messageId = messageData.id;

    // Check if already indexed
    const existing = await this.embeddingModel.findOne({ userId, emailId: messageId });
    if (existing) {
      return;
    }

    // Extract metadata
    const headers = messageData.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('subject');
    const from = getHeader('from');
    const to = (getHeader('to') || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const dateHeader = getHeader('date');
    const date = dateHeader ? new Date(dateHeader) : new Date();

    // Extract body text
    const bodyText = this.extractBodyText(messageData);
    if (!bodyText) {
      console.log(`No body content for message ${messageId}`);
      return;
    }

    // Preprocess and chunk
    const cleanedText = await this.preprocessEmailContent(bodyText, subject, from);
    const chunks = this.splitIntoChunks(cleanedText);

    // Generate embeddings in batch
    const embeddings = await this.embeddingService.batchGenerateEmbeddings(chunks);

    // Store embeddings
    const embeddingDocs = chunks.map((chunk, index) => ({
      userId,
      emailId: messageId,
      chunkIndex: index,
      embedding: embeddings[index],
      content: chunk,
      metadata: {
        from,
        to,
        subject,
        date,
        threadId: messageData.threadId,
        labels: messageData.labelIds || [],
        snippet: messageData.snippet || '',
        position: index === 0 ? 'subject' : index === chunks.length - 1 ? 'body_end' : 'body_middle',
        hasAttachments: this.hasAttachments(messageData.payload),
      },
    }));

    await this.embeddingModel.insertMany(embeddingDocs);
  }

  /**
   * Preprocess email content
   */
  private async preprocessEmailContent(
    emailBody: string,
    subject: string,
    from: string,
  ): Promise<string> {
    if (!emailBody) return '';

    let text = emailBody;
    if (emailBody.includes('<') && emailBody.includes('>')) {
      text = convert(emailBody, {
        wordwrap: false,
        preserveNewlines: true,
      });
    }

    // Remove signatures and quoted replies
    text = text.replace(/--\s*\n[\s\S]*$/, '');
    text = text.split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Add context
    const context = `Subject: ${subject}\nFrom: ${from}\n\n`;
    text = context + text;

    // Truncate if too long (~2000 chars)
    const maxLength = 2000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }

    return text;
  }

  /**
   * Split text into chunks (~500 tokens = ~2000 chars)
   */
  private splitIntoChunks(text: string): string[] {
    const maxChars = 2000;
    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 <= maxChars) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        if (paragraph.length > maxChars) {
          const sentences = paragraph.split(/[.!?]+\s+/);
          let sentenceChunk = '';
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length + 1 <= maxChars) {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            } else {
              if (sentenceChunk) chunks.push(sentenceChunk);
              sentenceChunk = sentence;
            }
          }
          currentChunk = sentenceChunk;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
  }

  /**
   * Extract body text from Gmail message
   */
  private extractBodyText(message: any): string {
    const payload = message.payload;
    if (!payload) return '';

    let bodyText = '';

    if (payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data && !bodyText) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          const nestedText = this.extractBodyFromParts(part.parts);
          if (nestedText) {
            bodyText = nestedText;
            break;
          }
        }
      }
    }

    return bodyText;
  }

  private extractBodyFromParts(parts: any[]): string {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        const nested = this.extractBodyFromParts(part.parts);
        if (nested) return nested;
      }
    }
    return '';
  }

  private hasAttachments(payload: any): boolean {
    if (!payload || !payload.parts) return false;
    
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        return true;
      }
      if (part.parts && this.hasAttachments(part)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<GmailSyncStateDocument | null> {
    return this.syncStateModel.findOne({ userId });
  }
}


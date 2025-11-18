import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Email, EmailDocument } from './schemas/email.schema';
import { EmailEmbedding, EmailEmbeddingDocument } from './schemas/email-embedding.schema';
import { GmailService } from '../gmail/gmail.service';
import { User, UserDocument } from '../user/schemas/user.schema';
import { convert } from 'html-to-text';
import OpenAI from 'openai';

@Injectable()
export class EmailIndexingService {
  private openai: OpenAI;

  constructor(
    @InjectModel(Email.name) private emailModel: Model<EmailDocument>,
    @InjectModel(EmailEmbedding.name) private embeddingModel: Model<EmailEmbeddingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(getConnectionToken()) private connection: Connection,
    private gmailService: GmailService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('OpenAI client initialized for embedding generation');
    } else {
      console.warn('OPENAI_API_KEY not configured - embedding generation will be skipped');
    }
  }

  /**
   * Extract and store email metadata only (no body content)
   */
  async indexMessageMetadata(userId: string, gmailMessage: any): Promise<EmailDocument> {
    const messageId = gmailMessage.id;
    const threadId = gmailMessage.threadId;

    // Check if email already indexed
    const existing = await this.emailModel.findOne({ messageId, userId });
    if (existing) {
      return existing;
    }

    // Extract headers
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('subject');
    const from = getHeader('from');
    const to = (getHeader('to') || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const cc = (getHeader('cc') || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const bcc = (getHeader('bcc') || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const replyTo = getHeader('reply-to');
    const dateHeader = getHeader('date');
    const date = dateHeader ? new Date(dateHeader) : new Date(gmailMessage.internalDate ? parseInt(gmailMessage.internalDate) : Date.now());

    // Extract snippet
    const snippet = gmailMessage.snippet || '';

    // Extract labels
    const labels = gmailMessage.labelIds || [];

    // Check for attachments
    const hasAttachments = this.hasAttachments(gmailMessage.payload);
    const attachmentCount = this.countAttachments(gmailMessage.payload);

    // Check read status
    const isRead = labels.includes('UNREAD') === false;

    const emailData = {
      messageId,
      threadId,
      userId,
      subject,
      from,
      to,
      cc,
      bcc,
      replyTo: replyTo || undefined,
      snippet,
      date,
      labels,
      isRead,
      hasAttachments,
      attachmentCount,
      indexedAt: new Date(),
      bodyFetched: false,
    };

    const email = new this.emailModel(emailData);
    return email.save();
  }

  /**
   * Check if initial indexing has been completed for a user
   */
  async hasInitialIndexingCompleted(userId: string): Promise<boolean> {
    const emailCount = await this.emailModel.countDocuments({ userId }).exec();
    return emailCount > 0;
  }

  /**
   * Find user document by Better-Auth user ID or email
   * Better-Auth stores users separately, so we need to find our User document
   */
  async findUserDocument(userId: string): Promise<UserDocument | null> {
    // Try finding by ID first (userId might be MongoDB ObjectId or Better-Auth ID)
    let user = await this.userModel.findById(userId).exec();
    if (user) {
      return user;
    }

    // Try finding by email (userId might be an email address)
    user = await this.userModel.findOne({ email: userId }).exec();
    if (user) {
      return user;
    }

    // If userId is a Better-Auth user ID, we need to get the email from Better-Auth
    // For now, we'll check the Better-Auth users collection
    const db = this.connection.db;
    const betterAuthUser = await db.collection('users').findOne({ id: userId });
    if (betterAuthUser?.email) {
      user = await this.userModel.findOne({ email: betterAuthUser.email }).exec();
      return user;
    }

    return null;
  }

  /**
   * Check if indexing is currently in progress for a user
   */
  async isIndexingInProgress(userId: string): Promise<boolean> {
    const user = await this.findUserDocument(userId);
    return user?.isEmailIndexingInProgress ?? false;
  }

  /**
   * Index initial emails (last day) - Synchronous version called by processor
   * This method does NOT check or set the isEmailIndexingInProgress flag
   * The processor handles that
   */
  async indexInitialEmailsSync(userId: string): Promise<{ indexed: number; errors: number }> {
    // Check if initial indexing has already been done
    const hasIndexed = await this.hasInitialIndexingCompleted(userId);
    if (hasIndexed) {
      console.log(`Initial indexing already completed for user ${userId}`);
      return { indexed: 0, errors: 0 };
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const query = `after:${Math.floor(oneDayAgo.getTime() / 1000)}`;

    let indexed = 0;
    let errors = 0;
    let pageToken: string | undefined;

    try {
      do {
        const result = await this.gmailService.listMessages(userId, pageToken, 50, query);
        
        if (!result.messages || result.messages.length === 0) {
          break;
        }

        // Extract message IDs for bulk retrieval
        const messageIds = result.messages.map(msg => msg.id);

        // Fetch full message content for all messages in bulk (need full content for embeddings)
        const messageDataArray = await this.gmailService.getMessagesBulk(
          userId,
          messageIds,
          'full',
          10, // Process 10 messages in parallel
        );

        // Index each message with metadata and embeddings
        for (let i = 0; i < messageDataArray.length; i++) {
          const messageData = messageDataArray[i];
          if (messageData) {
            try {
              // Index metadata first
              await this.indexMessageMetadata(userId, messageData);
              
              // Generate and store embeddings
              try {
                await this.indexMessageEmbeddings(userId, messageData);
              } catch (embeddingError) {
                // Log embedding errors but don't fail the entire indexing
                console.error(`Error generating embeddings for message ${messageIds[i]}:`, embeddingError);
                // Continue with next message
              }
              
              indexed++;
            } catch (error) {
              console.error(`Error indexing message ${messageIds[i]}:`, error);
              errors++;
            }
          } else {
            console.error(`Failed to fetch message ${messageIds[i]}`);
            errors++;
          }
        }

        pageToken = result.nextPageToken;
      } while (pageToken);

      console.log(`Indexed ${indexed} emails for user ${userId}, ${errors} errors`);
      return { indexed, errors };
    } catch (error) {
      console.error('Error in indexInitialEmailsSync:', error);
      throw error;
    }
  }

  /**
   * Queue initial email indexing job
   * Returns true if job was queued, false if already in progress or completed
   */
  async queueInitialIndexing(userId: string): Promise<boolean> {
    // Find user document (handles Better-Auth user IDs)
    const user = await this.findUserDocument(userId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Check if indexing is already in progress
    if (user.isEmailIndexingInProgress) {
      console.log(`Indexing already in progress for user ${userId}`);
      return false;
    }

    // Check if initial indexing has already been done
    const hasIndexed = await this.hasInitialIndexingCompleted(userId);
    if (hasIndexed) {
      console.log(`Initial indexing already completed for user ${userId}`);
      return false;
    }

    // Job will be queued by the caller (EmailIndexingQueue)
    return true;
  }

  /**
   * Index email embeddings from message data
   * This method extracts body, preprocesses, and generates embeddings
   */
  async indexMessageEmbeddings(userId: string, messageData: any): Promise<void> {
    const messageId = messageData.id;
    
    // Check if embeddings already exist
    const existingEmbeddings = await this.embeddingModel.findOne({
      userId,
      emailId: messageId, // Schema uses emailId field
    });
    
    if (existingEmbeddings) {
      console.log(`Embeddings already exist for message ${messageId}`);
      return; // Already indexed
    }

    // Check if OpenAI is configured
    if (!this.openai) {
      console.warn(`OpenAI not configured - skipping embedding generation for message ${messageId}`);
      return;
    }

    // Extract and preprocess body content
    const bodyText = this.extractBodyText(messageData);
    if (!bodyText) {
      console.log(`No body content found for message ${messageId} - skipping embeddings`);
      return; // No body content to embed
    }

    const subject = messageData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
    const from = messageData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
    
    const cleanedText = await this.preprocessEmailContent(bodyText, subject, from);

    if (!cleanedText) {
      console.log(`No cleaned text after preprocessing for message ${messageId} - skipping embeddings`);
      return;
    }

    // Generate embeddings in bulk
    const chunks = this.splitIntoChunks(cleanedText);
    console.log(`Generating embeddings for message ${messageId}: ${chunks.length} chunks`);
    
    // Generate embeddings for all chunks in parallel
    const embeddingPromises = chunks.map(async (chunk, index) => {
      try {
        const embedding = await this.generateEmbedding(chunk);
        return { embedding, chunk, index };
      } catch (error) {
        console.error(`Error generating embedding for chunk ${index} of message ${messageId}:`, error);
        return null;
      }
    });

    const embeddingResults = await Promise.all(embeddingPromises);
    const validResults = embeddingResults.filter((result): result is { embedding: number[]; chunk: string; index: number } => result !== null);
    
    console.log(`Generated ${validResults.length}/${chunks.length} embeddings for message ${messageId}`);

    if (validResults.length === 0) {
      console.warn(`No valid embeddings generated for message ${messageId}`);
      return;
    }

    // Store all embeddings
    try {
      const storePromises = validResults.map((result) =>
        this.storeEmbedding(userId, messageId, result.embedding, result.chunk, result.index)
      );

      await Promise.all(storePromises);
      console.log(`Stored ${validResults.length} embeddings for message ${messageId}`);
    } catch (error) {
      console.error(`Error storing embeddings for message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Index email on demand (when user views it)
   */
  async indexMessageOnDemand(userId: string, messageId: string): Promise<void> {
    // Check if already indexed with body
    const existing = await this.emailModel.findOne({ messageId, userId });
    if (existing?.bodyFetched) {
      return;
    }

    // Fetch full message
    const messageData = await this.gmailService.getMessage(userId, messageId);

    // Index metadata if not already indexed
    if (!existing) {
      await this.indexMessageMetadata(userId, messageData);
    }

    // Generate embeddings using the shared method
    await this.indexMessageEmbeddings(userId, messageData);

    // Mark as fetched
    await this.emailModel.updateOne(
      { messageId, userId },
      { $set: { bodyFetched: true } },
    );
  }

  /**
   * Preprocess email content for embedding
   */
  async preprocessEmailContent(
    emailBody: string,
    subject: string,
    from: string,
  ): Promise<string> {
    if (!emailBody) return '';

    // Convert HTML to text if needed
    let text = emailBody;
    if (emailBody.includes('<') && emailBody.includes('>')) {
      text = convert(emailBody, {
        wordwrap: false,
        preserveNewlines: true,
      });
    }

    // Remove email signatures (common patterns)
    text = text.replace(/--\s*\n[\s\S]*$/, ''); // Remove everything after "--"
    text = text.replace(/^[\s\S]*?(\n\n\n|\n---|\n___)/, ''); // Remove before multiple newlines or separators

    // Remove quoted replies (lines starting with >)
    text = text.split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // Remove URLs (optional - might want to keep for context)
    // text = text.replace(/https?:\/\/[^\s]+/g, '');

    // Remove email addresses (optional - might want to keep names)
    // text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Add context (subject and from)
    const context = `Subject: ${subject}\nFrom: ${from}\n\n`;
    text = context + text;

    // Truncate if too long (approximately 2000 tokens = ~8000 characters)
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }

    return text;
  }

  /**
   * Split text into chunks for embedding (max 500 tokens per chunk)
   */
  private splitIntoChunks(text: string, maxTokens: number = 500): string[] {
    // Approximate: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;
    const chunks: string[] = [];

    if (text.length <= maxChars) {
      return [text];
    }

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 <= maxChars) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        // If paragraph itself is too long, split by sentences
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
          if (sentenceChunk) currentChunk = sentenceChunk;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
  }

  /**
   * Generate embedding using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Store embedding in database
   */
  async storeEmbedding(
    userId: string,
    messageId: string,
    embedding: number[],
    chunkText: string,
    chunkIndex: number,
  ): Promise<EmailEmbeddingDocument> {
    // Check if embedding already exists
    const existing = await this.embeddingModel.findOne({
      userId,
      emailId: messageId, // Schema uses emailId field
      chunkIndex,
    });

    if (existing) {
      return existing;
    }

    const embeddingData = {
      emailId: messageId, // Schema uses emailId field (which is the Gmail messageId)
      userId,
      embedding,
      chunkIndex,
      chunkText, // Schema field name
    };

    const embeddingDoc = new this.embeddingModel(embeddingData);
    return embeddingDoc.save();
  }

  /**
   * Extract body text from Gmail message
   */
  private extractBodyText(message: any): string {
    const payload = message.payload;
    if (!payload) return '';

    // Try to get text/plain or text/html
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
          // Recursive search in nested parts
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

  /**
   * Recursively extract body from message parts
   */
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

  /**
   * Check if message has attachments
   */
  private hasAttachments(payload: any): boolean {
    if (!payload) return false;
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          return true;
        }
        if (part.parts && this.hasAttachments(part)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Count attachments in message
   */
  private countAttachments(payload: any): number {
    if (!payload) return 0;
    
    let count = 0;
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          count++;
        }
        if (part.parts) {
          count += this.countAttachments(part);
        }
      }
    }
    
    return count;
  }
}


import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { htmlToText } from 'html-to-text';
import { GmailService } from '../../gmail/gmail.service';

const decodeGmailBody = (data?: string): string => {
  if (!data) {
    return '';
  }

  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
};

const extractMessageBody = (payload?: any): string => {
  if (!payload) {
    return '';
  }

  if (payload.body?.data) {
    return decodeGmailBody(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        return decodeGmailBody(part.body?.data);
      }
    }

    for (const part of payload.parts) {
      if (part.mimeType === 'text/html') {
        return htmlToText(decodeGmailBody(part.body?.data) || '', {
          wordwrap: 120,
        });
      }
    }
  }

  return '';
};

export const createGmailThreadLoaderTool = (gmailService: GmailService) =>
  new DynamicStructuredTool({
    name: 'load_gmail_thread',
    description: 'Loads the full Gmail thread history to understand participants, tone, and context.',
    schema: z.object({
      threadId: z.string().describe('The Gmail thread ID to load'),
      userId: z.string().optional(),
    }),
    func: async ({ threadId, userId }) => {
      if (!userId) {
        throw new Error('userId is required to load Gmail thread');
      }

      const thread = await gmailService.getThread(userId, threadId);
      const messages = thread.messages ?? [];
      if (!messages.length) {
        return 'Thread is empty.';
      }

      const formatted = messages
        .map((message, index) => {
          const headers = (message.payload?.headers ?? []) as Array<{ name?: string; value?: string }>;
          const headerMap = headers.reduce((acc: Record<string, string>, header) => {
            if (header?.name && header?.value) {
              acc[header.name.toLowerCase()] = header.value;
            }
            return acc;
          }, {});

          const from = headerMap['from'] || 'Unknown sender';
          const to = headerMap['to'] || 'Unknown recipients';
          const subject = headerMap['subject'] || 'No subject';
          const date = headerMap['date'] || message.internalDate;
          const body = extractMessageBody(message.payload);

          return [
            `Message #${index + 1}`,
            `Subject: ${subject}`,
            `From: ${from}`,
            `To: ${to}`,
            `Date: ${date}`,
            `Body:\n${body || message.snippet || '[No body available]'}`,
          ].join('\n');
        })
        .join('\n\n---\n\n');

      return formatted;
    },
  });



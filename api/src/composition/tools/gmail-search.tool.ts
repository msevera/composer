import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { GmailService } from '../../gmail/gmail.service';

const headersToMap = (headers: Array<{ name?: string; value?: string }> = []) =>
  headers.reduce<Record<string, string>>((acc, header) => {
    if (header?.name && header?.value) {
      acc[header.name.toLowerCase()] = header.value;
    }
    return acc;
  }, {});

export const createGmailSearchTool = (gmailService: GmailService) =>
  new DynamicStructuredTool({
    name: 'search_gmail',
    description:
      'Searches the user’s Gmail account for relevant threads or historical context using Gmail query syntax.',
    schema: z.object({
      query: z.string().describe('Gmail search query, e.g. subject:invoice after:2024/01/01'),
      maxResults: z.number().int().positive().max(25).optional(),
      userId: z.string().optional(),
    }),
    func: async ({ query, maxResults = 10, userId }) => {
      if (!userId) {
        throw new Error('userId is required to search Gmail');
      }

      const listResponse = await gmailService.listMessages(userId, undefined, maxResults, query);

      const messageIds = listResponse.messages ?? [];
      if (!messageIds.length) {
        return 'No matching Gmail messages found for the provided query.';
      }

      const ids = messageIds.map((message) => message.id).filter(Boolean) as string[];
      const detailedMessages = await gmailService.getMessagesBulk(userId, ids, 'metadata');

      const summaries = detailedMessages.map((message) => {
        if (!message) {
          return null;
        }

        const headerMap = headersToMap(message.payload?.headers ?? []);

        return `Subject: ${headerMap['subject'] || 'No subject'}\nFrom: ${
          headerMap['from'] || 'Unknown'
        }\nDate: ${headerMap['date'] || message.internalDate || 'Unknown'}\nSnippet: ${message.snippet ?? ''}`;
      });

      return summaries.filter(Boolean).join('\n\n---\n\n') || 'No messages could be summarized.';
    },
  });



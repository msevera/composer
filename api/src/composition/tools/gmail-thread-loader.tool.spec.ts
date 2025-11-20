import { createGmailThreadLoaderTool } from './gmail-thread-loader.tool';
import { GmailService } from '../../gmail/gmail.service';

describe('createGmailThreadLoaderTool', () => {
  const gmailService = {
    getThread: jest.fn(),
  } as unknown as GmailService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats thread messages into human readable text', async () => {
    (gmailService.getThread as jest.Mock).mockResolvedValue({
      messages: [
        {
          payload: {
            headers: [
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'team@example.com' },
              { name: 'Subject', value: 'Status Update' },
              { name: 'Date', value: 'Thu, 20 Nov 2025 10:00:00 GMT' },
            ],
            body: {
              data: Buffer.from('Hello team!', 'utf-8')
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, ''),
            },
          },
        },
      ],
    });

    const tool = createGmailThreadLoaderTool(gmailService);
    const result = await tool.invoke({
      threadId: '123',
      userId: 'user-1',
    });

    expect(gmailService.getThread).toHaveBeenCalledWith('user-1', '123');
    expect(result).toContain('Message #1');
    expect(result).toContain('Status Update');
    expect(result).toContain('Hello team!');
  });
});



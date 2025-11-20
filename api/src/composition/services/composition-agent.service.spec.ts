import { ConfigService } from '@nestjs/config';
import { AIMessage } from '@langchain/core/messages';
import { CompositionAgentService } from './composition-agent.service';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';

const mockInvoke = jest.fn();

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    bindTools: jest.fn().mockReturnValue({
      invoke: mockInvoke,
    }),
  })),
}));

describe('CompositionAgentService', () => {
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;
  const gmailService = {
    getThread: jest.fn(),
    listMessages: jest.fn(),
    getMessagesBulk: jest.fn(),
  } as unknown as GmailService;
  const calendarService = {
    getCalendarEvents: jest.fn(),
  } as unknown as CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    (gmailService.getThread as jest.Mock).mockResolvedValue({ messages: [] });
    (gmailService.listMessages as jest.Mock).mockResolvedValue({ messages: [] });
    (gmailService.getMessagesBulk as jest.Mock).mockResolvedValue([]);
    (calendarService.getCalendarEvents as jest.Mock).mockResolvedValue({ items: [] });
    mockInvoke.mockResolvedValue(
      new AIMessage({
        content: 'Here is the requested email draft.',
      }),
    );
  });

  it('returns draft when LLM produces assistant response', async () => {
    const service = new CompositionAgentService(configService, gmailService, calendarService);
    const result = await service.compose({
      userPrompt: 'Respond to Alex about the meeting.',
      userId: 'user-1',
      threadId: 'thread-1',
    });

    if (result.status !== 'DRAFT_READY') {
      throw new Error('Expected draft to be ready');
    }

    expect(result.draftContent).toContain('requested email draft');
    expect(result.conversationId).toContain('composition-user-1-thread-1');
    expect(result.activityLog.length).toBeGreaterThan(0);
  });
});



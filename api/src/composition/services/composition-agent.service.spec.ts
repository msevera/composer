import { ConfigService } from '@nestjs/config';
import { AIMessage } from '@langchain/core/messages';
import { CompositionAgentService } from './composition-agent.service';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';

const mockBoundInvoke = jest.fn();
const mockWorkerInvoke = jest.fn();
const mockWorkerStream = jest.fn();
const mockBindTools = jest.fn();
let chatConstructorCount = 0;

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => {
    if (chatConstructorCount === 0) {
      chatConstructorCount += 1;
      return {
        bindTools: mockBindTools,
        invoke: jest.fn(),
        stream: jest.fn(),
      };
    }
    chatConstructorCount += 1;
    return {
      bindTools: jest.fn(),
      invoke: mockWorkerInvoke,
      stream: mockWorkerStream,
    };
  }),
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
    chatConstructorCount = 0;
    mockBoundInvoke.mockReset();
    mockWorkerInvoke.mockReset();
    mockWorkerStream.mockReset();
    mockBindTools.mockReset();
    mockBindTools.mockReturnValue({
      invoke: mockBoundInvoke,
    });
    (gmailService.getThread as jest.Mock).mockResolvedValue({ messages: [] });
    (gmailService.listMessages as jest.Mock).mockResolvedValue({ messages: [] });
    (gmailService.getMessagesBulk as jest.Mock).mockResolvedValue([]);
    (calendarService.getCalendarEvents as jest.Mock).mockResolvedValue({ items: [] });
    mockBoundInvoke.mockResolvedValue(
      new AIMessage({
        content: 'Use a helpful tone referencing the latest email.',
      }),
    );
    mockWorkerInvoke.mockResolvedValue(
      new AIMessage({
        content: 'Draft from worker model',
      }),
    );
    mockWorkerStream.mockImplementation(async function* streamMock() {
      // no streaming in tests by default
    });
  });

  it('returns draft when supervisor produces draft outcome', async () => {
    const service = new CompositionAgentService(configService, gmailService, calendarService);
    const result = await service.compose({
      userPrompt: 'Respond to Alex about the meeting.',
      userId: 'user-1',
      threadId: 'thread-1',
    });

    if (result.status !== 'DRAFT_READY') {
      throw new Error('Expected draft to be ready');
    }

    expect(result.draftContent).toContain('Draft from worker model');
    expect(result.activityLog).toEqual(expect.arrayContaining(['Loaded Gmail thread context.', 'Email draft generated.']));
  });

  it('fails when threadId is missing', async () => {
    const service = new CompositionAgentService(configService, gmailService, calendarService);
    await expect(
      service.compose({
        userPrompt: 'Need info',
        userId: 'user-1',
      } as any),
    ).rejects.toThrow('threadId is required to compose a draft.');
  });
});


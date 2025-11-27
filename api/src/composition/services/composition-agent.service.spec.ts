import { ConfigService } from '@nestjs/config';
import { AIMessage } from '@langchain/core/messages';
import { GmailService } from '../../gmail/gmail.service';
import { CalendarService } from '../../gmail/calendar.service';
import { UserService } from 'src/user/user.service';

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
  const userService = {
    findById: jest.fn(),
  } as unknown as UserService;
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
});


import { CompositionService } from './composition.service';
import { CompositionAgentService, AgentExecutionResult } from './services/composition-agent.service';

describe('CompositionService', () => {
  const agentService = {
    compose: jest.fn(),
    resume: jest.fn(),
  } as unknown as CompositionAgentService;

  const service = new CompositionService(agentService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates composition to agent service with user context', async () => {
    (agentService.compose as jest.Mock).mockResolvedValue({
      status: 'DRAFT_READY',
      draftContent: 'Draft',
      conversationId: 'conversation-1',
      messages: [],
      activityLog: ['Generating draft...'],
    } satisfies AgentExecutionResult);

    const result = await service.composeDraftWithAgent('user-123', {
      userPrompt: 'Hello?',
    } as any);

    expect(agentService.compose).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: 'Hello?',
        userId: 'user-123',
      }),
    );
    expect(result.status).toEqual('DRAFT_READY');
  });

  it('resumes composition via agent service', async () => {
    (agentService.resume as jest.Mock).mockResolvedValue({
      status: 'NEEDS_INPUT',
      question: 'Need more context?',
      conversationId: 'conversation-1',
      activityLog: ['Requesting clarification…'],
    } satisfies AgentExecutionResult);

    const result = await service.resumeDraftComposition({
      conversationId: 'conversation-1',
      userResponse: 'Here is more context',
    });

    expect(agentService.resume).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userResponse: 'Here is more context',
    });
    expect(result.status).toEqual('NEEDS_INPUT');
  });
});



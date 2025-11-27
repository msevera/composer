import { CompositionService } from './composition.service';
import { CompositionAgentService } from './services/composition-agent.service';

describe('CompositionService', () => {
  const agentService = {
    compose: jest.fn(),
    resume: jest.fn(),
  } as unknown as CompositionAgentService;

  const service = new CompositionService(agentService);

  beforeEach(() => {
    jest.clearAllMocks();
  });
});



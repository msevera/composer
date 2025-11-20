import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { interrupt } from '@langchain/langgraph';

export const createHumanInputTool = () =>
  new DynamicStructuredTool({
    name: 'ask_user_for_clarification',
    description: 'Use when the user prompt is ambiguous or missing critical information.',
    schema: z.object({
      question: z.string().describe('A concise clarification question for the user'),
    }),
    func: async ({ question }) => {
      const userResponse = await interrupt({ question });
      return userResponse || 'Awaiting user response...';
    },
  });



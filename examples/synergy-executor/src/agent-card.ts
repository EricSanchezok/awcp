/**
 * Agent Card for Synergy Executor
 */

import type { AgentCard } from '@a2a-js/sdk';

export const synergyAgentCard: AgentCard = {
  name: 'Synergy Coding Agent',
  description: 'AI coding agent powered by Synergy. Can read, write, and modify code in delegated workspaces via AWCP.',
  url: 'http://localhost:4001',
  version: '0.1.0',
  protocolVersion: '0.2.1',
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'code-generation',
      name: 'Code Generation',
      description: 'Generate code based on requirements and specifications',
      tags: ['code', 'generation', 'development'],
      examples: [
        'Create a REST API endpoint for user authentication',
        'Implement a function to parse CSV files',
        'Add unit tests for the UserService class',
      ],
    },
    {
      id: 'code-modification',
      name: 'Code Modification',
      description: 'Modify and refactor existing code in the workspace',
      tags: ['code', 'refactor', 'modification'],
      examples: [
        'Refactor this function to use async/await',
        'Add error handling to the database queries',
        'Update the API to use the new authentication flow',
      ],
    },
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code and suggest improvements',
      tags: ['code', 'review', 'analysis'],
      examples: [
        'Review the security of this authentication module',
        'Find potential bugs in this function',
        'Suggest performance improvements',
      ],
    },
    {
      id: 'debugging',
      name: 'Debugging',
      description: 'Find and fix bugs in the codebase',
      tags: ['debug', 'fix', 'bugs'],
      examples: [
        'Why is this test failing?',
        'Find the source of this null pointer exception',
        'Debug the race condition in the worker pool',
      ],
    },
  ],
};

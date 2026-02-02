/**
 * Agent Card for OpenClaw Executor
 * 
 * OpenClaw is a powerful open-source AI assistant with multi-channel support,
 * sandbox execution, and rich tool ecosystem.
 */

import type { AgentCard } from '@a2a-js/sdk';
import { loadConfig } from './config.js';

const config = loadConfig();

export const openclawAgentCard: AgentCard = {
  name: 'OpenClaw Executor',
  description: [
    'AWCP Executor powered by OpenClaw - an open-source AI assistant.',
    '',
    'Core capabilities:',
    '• OpenAI-compatible HTTP API with SSE streaming',
    '• Sandbox execution with Docker isolation',
    '• Rich tool ecosystem: browser, canvas, file ops, exec',
    '• Multi-agent support with session isolation',
    '',
    'Operates on delegated workspaces via AWCP protocol.',
  ].join('\n'),
  url: `http://localhost:${config.port}`,
  version: '0.1.0',
  protocolVersion: '0.2.1',
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'code-execution',
      name: 'Code Execution',
      description: 'Execute coding tasks including file creation, modification, and running commands in isolated sandboxes.',
      tags: ['coding', 'development', 'automation', 'sandbox'],
      examples: [
        'Create a new TypeScript file with a greeting function',
        'Refactor the existing code to use async/await',
        'Add unit tests for the utility functions',
        'Fix the bug in the authentication module',
      ],
    },
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code and provide suggestions for improvements, security analysis, and best practices.',
      tags: ['review', 'quality', 'best-practices', 'security'],
      examples: [
        'Review the PR and suggest improvements',
        'Check the code for security vulnerabilities',
        'Analyze the codebase and identify technical debt',
      ],
    },
    {
      id: 'documentation',
      name: 'Documentation',
      description: 'Generate and update documentation including READMEs, API docs, and code comments.',
      tags: ['docs', 'readme', 'api-docs', 'comments'],
      examples: [
        'Generate API documentation for the service',
        'Update the README with installation instructions',
        'Add JSDoc comments to the functions',
      ],
    },
    {
      id: 'web-automation',
      name: 'Web Automation',
      description: 'Browser automation for web testing, screenshots, and data extraction using OpenClaw browser tools.',
      tags: ['browser', 'automation', 'testing', 'scraping'],
      examples: [
        'Take a screenshot of the landing page',
        'Fill out and submit a form',
        'Extract data from a web page',
      ],
    },
  ],
};

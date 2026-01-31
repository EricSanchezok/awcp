/**
 * Synergy Executor Agent
 * 
 * A2A Agent with AWCP support for executing coding tasks
 * using Synergy AI coding agent on delegated workspaces.
 */

import express from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { executorHandler } from '@awcp/sdk/server/express';

import { synergyAgentCard } from './agent-card.js';
import { SynergyExecutor } from './synergy-executor.js';
import { awcpConfig } from './awcp-config.js';
import { loadConfig } from './config.js';

const config = loadConfig();

// Create Synergy executor instance
const executor = new SynergyExecutor(config.synergyUrl);

// A2A Request Handler
const requestHandler = new DefaultRequestHandler(
  synergyAgentCard,
  new InMemoryTaskStore(),
  executor
);

// Create Express app
const app = express();

// A2A endpoints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }) as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use('/a2a', jsonRpcHandler({
  requestHandler,
  userBuilder: UserBuilder.noAuthentication
}) as any);

// AWCP endpoint with hooks to control executor's working directory
const awcpConfigWithHooks = {
  ...awcpConfig,
  hooks: {
    ...awcpConfig.hooks,
    onTaskStart: (delegationId: string, workPath: string) => {
      // Set the executor's working directory to the mounted/extracted workspace
      executor.setWorkingDirectory(workPath);
      awcpConfig.hooks?.onTaskStart?.(delegationId, workPath);
    },
    onTaskComplete: (delegationId: string, summary: string) => {
      // Clear the working directory after task completes
      executor.clearWorkingDirectory();
      awcpConfig.hooks?.onTaskComplete?.(delegationId, summary);
    },
    onError: (delegationId: string, error: Error) => {
      executor.clearWorkingDirectory();
      awcpConfig.hooks?.onError?.(delegationId, error);
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use('/awcp', executorHandler({ executor, config: awcpConfigWithHooks }) as any);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', synergy: config.synergyUrl });
});

// Start server
app.listen(config.port, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Synergy Executor Agent Started                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Agent Card:  http://localhost:${config.port}/${AGENT_CARD_PATH.padEnd(26)}║`);
  console.log(`║  A2A:         http://localhost:${config.port}/a2a${' '.repeat(24)}║`);
  console.log(`║  AWCP:        http://localhost:${config.port}/awcp${' '.repeat(23)}║`);
  console.log(`║  Synergy:     ${config.synergyUrl.padEnd(43)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

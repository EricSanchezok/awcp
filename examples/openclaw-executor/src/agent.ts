/**
 * OpenClaw Executor Agent
 * 
 * A2A Agent with AWCP support for executing coding tasks
 * using OpenClaw AI assistant on delegated workspaces.
 */

import express from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { executorHandler } from '@awcp/sdk/server/express';
import { resolveWorkDir, type TaskStartContext } from '@awcp/sdk';

import { openclawAgentCard } from './agent-card.js';
import { OpenClawExecutor } from './openclaw-executor.js';
import { OpenClawGatewayManager } from './gateway-manager.js';
import { createAwcpConfig } from './awcp-config.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         OpenClaw Executor Agent - Starting...              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const gatewayManager = new OpenClawGatewayManager(config);
  await gatewayManager.start();

  const executor = new OpenClawExecutor(config, gatewayManager);

  const requestHandler = new DefaultRequestHandler(
    openclawAgentCard,
    new InMemoryTaskStore(),
    executor
  );

  const app = express();

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }) as unknown as express.RequestHandler);
  app.use('/a2a', jsonRpcHandler({
    requestHandler,
    userBuilder: UserBuilder.noAuthentication
  }) as unknown as express.RequestHandler);

  const awcpConfig = createAwcpConfig(config, executor, gatewayManager);

  const awcpConfigWithHooks = {
    ...awcpConfig,
    hooks: {
      ...awcpConfig.hooks,
      onTaskStart: async (ctx: TaskStartContext) => {
        const workDir = resolveWorkDir(ctx);
        executor.setWorkingDirectory(workDir, {
          leaseExpiresAt: new Date(ctx.lease.expiresAt),
          delegationId: ctx.delegationId,
          taskId: ctx.delegationId,
        });
        await gatewayManager.updateWorkspace(workDir);
        await awcpConfig.hooks?.onTaskStart?.(ctx);
      },
      onTaskComplete: (delegationId: string, summary: string) => {
        executor.clearWorkingDirectory();
        awcpConfig.hooks?.onTaskComplete?.(delegationId, summary);
      },
      onError: (delegationId: string, error: Error) => {
        executor.clearWorkingDirectory();
        awcpConfig.hooks?.onError?.(delegationId, error);
      },
    },
  };

  app.use('/awcp', executorHandler({ executor, config: awcpConfigWithHooks }) as unknown as express.RequestHandler);

  app.get('/health', async (_req, res) => {
    const gatewayHealthy = await gatewayManager.checkHealth();
    res.json({
      status: gatewayHealthy ? 'ok' : 'degraded',
      gateway: {
        url: config.gatewayUrl,
        healthy: gatewayHealthy,
        pid: gatewayManager.pid,
      },
    });
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Agent] Received ${signal}, shutting down...`);
    await gatewayManager.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  app.listen(config.port, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         OpenClaw Executor Agent Ready!                         ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Agent Card:  http://localhost:${config.port}/.well-known/agent-card.json║`);
    console.log(`║  A2A:         http://localhost:${config.port}/a2a                        ║`);
    console.log(`║  AWCP:        http://localhost:${config.port}/awcp                       ║`);
    console.log(`║  OpenClaw:    ${config.gatewayUrl.padEnd(47)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Press Ctrl+C to stop...');
  });
}

main().catch((error) => {
  console.error('Failed to start OpenClaw Executor:', error);
  process.exit(1);
});

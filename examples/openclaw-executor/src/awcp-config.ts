/**
 * AWCP Configuration for OpenClaw Executor
 * 
 * Uses Archive transport by default (HTTP-based, no SSHFS required).
 */

import type { ExecutorConfig, TaskStartContext } from '@awcp/sdk';
import type { InviteMessage, TransportAdapter } from '@awcp/core';
import { SshfsTransport } from '@awcp/transport-sshfs';
import { ArchiveTransport } from '@awcp/transport-archive';
import type { OpenClawExecutorConfig } from './config.js';
import type { OpenClawExecutor } from './openclaw-executor.js';
import type { OpenClawGatewayManager } from './gateway-manager.js';

const transportType = process.env.AWCP_TRANSPORT || 'archive';

function createTransport(config: OpenClawExecutorConfig): TransportAdapter {
  switch (transportType) {
    case 'sshfs':
      console.log('[AWCP] Using SSHFS transport');
      return new SshfsTransport();

    case 'archive':
    default:
      console.log('[AWCP] Using Archive transport (HTTP-based)');
      return new ArchiveTransport({
        executor: {
          tempDir: config.tempDir,
        },
      });
  }
}

export function createAwcpConfig(
  config: OpenClawExecutorConfig,
  executor: OpenClawExecutor,
  gatewayManager: OpenClawGatewayManager,
): ExecutorConfig {
  return {
    workDir: config.workDir,
    transport: createTransport(config),
    sandbox: {
      cwdOnly: true,
      allowNetwork: true,
      allowExec: true,
    },
    policy: {
      maxConcurrentDelegations: 3,
      maxTtlSeconds: 7200,
      autoAccept: false,
    },
    hooks: {
      onInvite: async (invite: InviteMessage) => {
        console.log(`[AWCP] Received INVITE: ${invite.delegationId}`);
        console.log(`[AWCP] Task: ${invite.task.description}`);
        console.log(`[AWCP] Accepting invitation`);
        return true;
      },

      onTaskStart: async (ctx: TaskStartContext) => {
        const { delegationId, workPath, lease, task } = ctx;

        console.log(`[AWCP] Task started: ${delegationId}`);
        console.log(`[AWCP] Workspace: ${workPath}`);
        console.log(`[AWCP] Lease expires: ${lease.expiresAt}`);

        executor.setWorkingDirectory(workPath, {
          delegationId,
          taskId: delegationId,
          leaseExpiresAt: new Date(lease.expiresAt),
        });

        await gatewayManager.updateWorkspace(workPath);
      },

      onTaskComplete: (delegationId: string, summary: string) => {
        console.log(`[AWCP] Task completed: ${delegationId}`);
        console.log(`[AWCP] Summary: ${summary.slice(0, 200)}...`);

        executor.clearWorkingDirectory();
      },

      onError: (delegationId: string, error: Error) => {
        console.error(`[AWCP] Task error: ${delegationId}`, error.message);
        executor.clearWorkingDirectory();
      },
    },
  };
}

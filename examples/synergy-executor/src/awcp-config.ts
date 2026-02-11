/**
 * AWCP Configuration for Synergy Executor
 *
 * Uses Archive transport by default (HTTP-based, no SSHFS required).
 */

import type { ExecutorConfig, TaskStartContext } from '@awcp/sdk';
import type { ExecutorTransportAdapter, InviteMessage } from '@awcp/core';
import { SshfsExecutorTransport } from '@awcp/transport-sshfs';
import { ArchiveExecutorTransport } from '@awcp/transport-archive';
import { loadConfig } from './config.js';

const config = loadConfig();

const transportType = process.env.AWCP_TRANSPORT || 'archive';

function createTransport(): ExecutorTransportAdapter {
  switch (transportType) {
    case 'sshfs':
      console.log('[AWCP] Using SSHFS transport');
      return new SshfsExecutorTransport();

    case 'archive':
    default:
      console.log('[AWCP] Using Archive transport (HTTP-based)');
      return new ArchiveExecutorTransport({
        tempDir: `${config.scenarioDir}/temp`,
      });
  }
}

export const awcpConfig: ExecutorConfig = {
  workDir: `${config.scenarioDir}/workdir`,
  transport: createTransport(),
  admission: {
    maxConcurrentDelegations: 3,
    maxTtlSeconds: 7200,
  },
  assignment: {
    sandbox: {
      cwdOnly: true,
      allowNetwork: true,
      allowExec: true,
    },
  },
  hooks: {
    onAdmissionCheck: async (invite: InviteMessage) => {
      console.log(`[AWCP] Received INVITE: ${invite.delegationId}`);
      console.log(`[AWCP] Task: ${invite.task.description}`);
      console.log(`[AWCP] Accepting invitation`);
    },

    onTaskStart: (ctx: TaskStartContext) => {
      console.log(`[AWCP] Task started: ${ctx.delegationId}`);
      console.log(`[AWCP] Workspace: ${ctx.workPath}`);
      console.log(`[AWCP] Lease expires: ${ctx.lease.expiresAt}`);
    },

    onTaskComplete: (delegationId: string, summary: string) => {
      console.log(`[AWCP] Task completed: ${delegationId}`);
      console.log(`[AWCP] Summary: ${summary.slice(0, 200)}...`);
    },

    onError: (delegationId: string, error: Error) => {
      console.error(`[AWCP] Task error: ${delegationId}`, error.message);
    },
  },
};

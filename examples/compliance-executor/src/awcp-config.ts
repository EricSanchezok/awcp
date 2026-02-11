/**
 * AWCP Configuration for Compliance Executor
 *
 * Uses Archive transport for ZIP-based file transfer.
 */

import type { ExecutorConfig, TaskStartContext } from '@awcp/sdk';
import type { InviteMessage } from '@awcp/core';
import { ArchiveExecutorTransport } from '@awcp/transport-archive';
import { loadConfig } from './config.js';

const config = loadConfig();

export const awcpConfig: ExecutorConfig = {
  workDir: `${config.scenarioDir}/workdir`,
  transport: new ArchiveExecutorTransport({
    tempDir: `${config.scenarioDir}/temp`,
  }),
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

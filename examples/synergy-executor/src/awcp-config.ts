/**
 * AWCP Configuration for Synergy Executor
 * 
 * Uses Archive transport by default (HTTP-based, no SSHFS required).
 */

import type { ExecutorConfig } from '@awcp/sdk';
import type { InviteMessage, TransportAdapter } from '@awcp/core';
import { SshfsTransport } from '@awcp/transport-sshfs';
import { ArchiveTransport } from '@awcp/transport-archive';
import { loadConfig } from './config.js';

const config = loadConfig();

// Transport selection: 'archive' (default) or 'sshfs'
const transportType = process.env.AWCP_TRANSPORT || 'archive';

function createTransport(): TransportAdapter {
  switch (transportType) {
    case 'sshfs':
      console.log('[AWCP] Using SSHFS transport');
      return new SshfsTransport();

    case 'archive':
    default:
      console.log('[AWCP] Using Archive transport (HTTP-based)');
      return new ArchiveTransport({
        executor: {
          tempDir: `${config.scenarioDir}/temp`,
        },
      });
  }
}

export const awcpConfig: ExecutorConfig = {
  workDir: `${config.scenarioDir}/workdir`,
  transport: createTransport(),
  sandbox: {
    cwdOnly: true,
    allowNetwork: true,  // Synergy may need network for AI API calls
    allowExec: true,     // Synergy may run commands
  },
  policy: {
    maxConcurrentDelegations: 3,
    maxTtlSeconds: 7200,  // 2 hours for longer coding tasks
    autoAccept: false,
  },
  hooks: {
    onInvite: async (invite: InviteMessage) => {
      console.log(`[AWCP] Received INVITE: ${invite.delegationId}`);
      console.log(`[AWCP] Task: ${invite.task.description}`);
      console.log(`[AWCP] Accepting invitation`);
      return true;
    },

    onTaskStart: (delegationId: string, workPath: string) => {
      console.log(`[AWCP] Task started: ${delegationId}`);
      console.log(`[AWCP] Workspace: ${workPath}`);
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

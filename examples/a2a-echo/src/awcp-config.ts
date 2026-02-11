/**
 * AWCP Configuration for Echo Agent
 */

import type { ExecutorConfig, TaskStartContext } from '@awcp/sdk';
import { SshfsExecutorTransport } from '@awcp/transport-sshfs';

export const awcpConfig: ExecutorConfig = {
  workDir: '/tmp/awcp/mounts',
  transport: new SshfsExecutorTransport(),
  admission: {
    maxConcurrentDelegations: 3,
    maxTtlSeconds: 3600,
  },
  assignment: {
    sandbox: {
      cwdOnly: true,
      allowNetwork: true,
      allowExec: true,
    },
  },
  hooks: {
    onTaskStart: (ctx: TaskStartContext) => {
      console.log(`[AWCP] Task started: ${ctx.delegationId} at ${ctx.workPath}`);
    },
    onTaskComplete: (delegationId: string, summary: string) => {
      console.log(`[AWCP] Task completed: ${delegationId}`);
      console.log(`[AWCP] Summary: ${summary}`);
    },
    onError: (delegationId: string, error: Error) => {
      console.error(`[AWCP] Task error: ${delegationId}`, error.message);
    },
  },
};

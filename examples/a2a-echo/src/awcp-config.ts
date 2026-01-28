/**
 * AWCP Configuration for Echo Agent
 */

import type { AwcpRemoteConfig } from '@awcp/sdk';

export const awcpConfig: AwcpRemoteConfig = {
  mount: {
    root: '/tmp/awcp/mounts',
  },
  sandbox: {
    cwdOnly: true,
    allowNetwork: true,
    allowExec: true,
  },
  policy: {
    maxConcurrentDelegations: 3,
    maxTtlSeconds: 3600,
    autoAccept: true,
  },
  hooks: {
    onTaskStart: (delegationId, mountPoint) => {
      console.log(`[AWCP] Task started: ${delegationId} at ${mountPoint}`);
    },
    onTaskComplete: (delegationId, summary) => {
      console.log(`[AWCP] Task completed: ${delegationId}`);
      console.log(`[AWCP] Summary: ${summary}`);
    },
    onError: (delegationId, error) => {
      console.error(`[AWCP] Task error: ${delegationId}`, error.message);
    },
  },
};

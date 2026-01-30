/**
 * AWCP Executor Configuration
 */

import type { InviteMessage, SandboxProfile, AccessMode, ExecutorTransportAdapter } from '@awcp/core';

export interface MountConfig {
  /** Root directory for mount points */
  root: string;
}

export interface PolicyConstraints {
  maxConcurrentDelegations?: number;
  maxTtlSeconds?: number;
  allowedAccessModes?: AccessMode[];
  autoAccept?: boolean;
}

export interface ExecutorHooks {
  onInvite?: (invite: InviteMessage) => Promise<boolean>;
  onTaskStart?: (delegationId: string, mountPoint: string) => void;
  onTaskComplete?: (delegationId: string, summary: string) => void;
  onError?: (delegationId: string, error: Error) => void;
}

export interface ExecutorConfig {
  mount: MountConfig;
  transport: ExecutorTransportAdapter;
  sandbox?: SandboxProfile;
  policy?: PolicyConstraints;
  hooks?: ExecutorHooks;
}

export const DEFAULT_EXECUTOR_CONFIG = {
  policy: {
    maxConcurrentDelegations: 5,
    maxTtlSeconds: 3600,
    allowedAccessModes: ['ro', 'rw'] as AccessMode[],
    autoAccept: true,
  },
  sandbox: {
    cwdOnly: true,
    allowNetwork: true,
    allowExec: true,
  },
} as const;

export interface ResolvedPolicyConstraints {
  maxConcurrentDelegations: number;
  maxTtlSeconds: number;
  allowedAccessModes: AccessMode[];
  autoAccept: boolean;
}

export interface ResolvedExecutorConfig {
  mount: MountConfig;
  transport: ExecutorTransportAdapter;
  sandbox: SandboxProfile;
  policy: ResolvedPolicyConstraints;
  hooks: ExecutorHooks;
}

export function resolveExecutorConfig(config: ExecutorConfig): ResolvedExecutorConfig {
  return {
    mount: config.mount,
    transport: config.transport,
    sandbox: config.sandbox ?? { ...DEFAULT_EXECUTOR_CONFIG.sandbox },
    policy: {
      maxConcurrentDelegations: config.policy?.maxConcurrentDelegations ?? DEFAULT_EXECUTOR_CONFIG.policy.maxConcurrentDelegations,
      maxTtlSeconds: config.policy?.maxTtlSeconds ?? DEFAULT_EXECUTOR_CONFIG.policy.maxTtlSeconds,
      allowedAccessModes: config.policy?.allowedAccessModes ?? [...DEFAULT_EXECUTOR_CONFIG.policy.allowedAccessModes],
      autoAccept: config.policy?.autoAccept ?? DEFAULT_EXECUTOR_CONFIG.policy.autoAccept,
    },
    hooks: config.hooks ?? {},
  };
}

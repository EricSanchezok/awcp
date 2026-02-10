/**
 * AWCP Executor Configuration
 */

import type {
  InviteMessage,
  SandboxProfile,
  AccessMode,
  ExecutorTransportAdapter,
  ActiveLease,
  TaskSpec,
  EnvironmentDeclaration,
  ListenerAdapter,
  ListenerInfo,
  LifecycleConfig,
} from '@awcp/core';

export interface ExecutorAdmissionConfig {
  maxConcurrentDelegations?: number;
  maxTtlSeconds?: number;
  allowedAccessModes?: AccessMode[];
}

export interface ExecutorDefaults {
  autoAccept?: boolean;
  resultRetentionMs?: number;
}

export interface TaskStartContext {
  delegationId: string;
  workPath: string;
  task: TaskSpec;
  lease: ActiveLease;
  environment: EnvironmentDeclaration;
}

export interface ExecutorHooks {
  onInvite?: (invite: InviteMessage) => Promise<boolean>;
  onTaskStart?: (context: TaskStartContext) => void;
  onTaskComplete?: (delegationId: string, summary: string) => void;
  onError?: (delegationId: string, error: Error) => void;
  onListenerConnected?: (info: ListenerInfo) => void;
  onListenerDisconnected?: (type: string, error?: Error) => void;
}

export interface ExecutorConfig {
  workDir: string;
  transport: ExecutorTransportAdapter;
  sandbox?: SandboxProfile;
  admission?: ExecutorAdmissionConfig;
  defaults?: ExecutorDefaults;
  lifecycle?: LifecycleConfig;
  hooks?: ExecutorHooks;
  listeners?: ListenerAdapter[];
}

export const DEFAULT_EXECUTOR_CONFIG = {
  admission: {
    maxConcurrentDelegations: 5,
    maxTtlSeconds: 3600,
    allowedAccessModes: ['ro', 'rw'] as AccessMode[],
  },
  defaults: {
    autoAccept: true,
    resultRetentionMs: 30 * 60 * 1000,
  },
  lifecycle: {
    cleanupOnShutdown: true,
    cleanupStaleOnStartup: true,
  },
  sandbox: {
    cwdOnly: true,
    allowNetwork: true,
    allowExec: true,
  },
} as const;

export interface ResolvedExecutorConfig {
  workDir: string;
  transport: ExecutorTransportAdapter;
  sandbox: SandboxProfile;
  admission: Required<ExecutorAdmissionConfig>;
  defaults: Required<ExecutorDefaults>;
  lifecycle: Required<LifecycleConfig>;
  hooks: ExecutorHooks;
  listeners: ListenerAdapter[];
}

export function resolveExecutorConfig(config: ExecutorConfig): ResolvedExecutorConfig {
  return {
    workDir: config.workDir,
    transport: config.transport,
    sandbox: config.sandbox ?? { ...DEFAULT_EXECUTOR_CONFIG.sandbox },
    admission: {
      maxConcurrentDelegations: config.admission?.maxConcurrentDelegations ?? DEFAULT_EXECUTOR_CONFIG.admission.maxConcurrentDelegations,
      maxTtlSeconds: config.admission?.maxTtlSeconds ?? DEFAULT_EXECUTOR_CONFIG.admission.maxTtlSeconds,
      allowedAccessModes: config.admission?.allowedAccessModes ?? [...DEFAULT_EXECUTOR_CONFIG.admission.allowedAccessModes],
    },
    defaults: {
      autoAccept: config.defaults?.autoAccept ?? DEFAULT_EXECUTOR_CONFIG.defaults.autoAccept,
      resultRetentionMs: config.defaults?.resultRetentionMs ?? DEFAULT_EXECUTOR_CONFIG.defaults.resultRetentionMs,
    },
    lifecycle: {
      cleanupOnShutdown: config.lifecycle?.cleanupOnShutdown ?? DEFAULT_EXECUTOR_CONFIG.lifecycle.cleanupOnShutdown,
      cleanupStaleOnStartup: config.lifecycle?.cleanupStaleOnStartup ?? DEFAULT_EXECUTOR_CONFIG.lifecycle.cleanupStaleOnStartup,
    },
    hooks: config.hooks ?? {},
    listeners: config.listeners ?? [],
  };
}

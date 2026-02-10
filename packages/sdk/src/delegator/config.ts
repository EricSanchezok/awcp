/**
 * AWCP Delegator Configuration
 */

import type { Delegation, AccessMode, SnapshotMode, DelegatorTransportAdapter, EnvironmentSnapshot } from '@awcp/core';
import type { AdmissionConfig } from './admission.js';

// Re-export for convenience
export type { AdmissionConfig } from './admission.js';

export interface DelegationConfig {
  lease?: {
    ttlSeconds?: number;
    accessMode?: AccessMode;
  };
  snapshot?: {
    mode?: SnapshotMode;
    retentionMs?: number;
    maxSnapshots?: number;
  };
  connection?: {
    requestTimeout?: number;
    sseMaxRetries?: number;
    sseRetryDelayMs?: number;
  };
}

export interface DelegatorHooks {
  onAdmissionCheck?: (localDir: string) => Promise<void>;
  onDelegationCreated?: (delegation: Delegation) => void;
  onDelegationStarted?: (delegation: Delegation) => void;
  onDelegationCompleted?: (delegation: Delegation) => void;
  onSnapshotReceived?: (delegation: Delegation, snapshot: EnvironmentSnapshot) => void;
  onSnapshotApplied?: (delegation: Delegation, snapshot: EnvironmentSnapshot) => void;
  onError?: (delegationId: string, error: Error) => void;
}

export interface DelegatorConfig {
  baseDir: string;
  transport: DelegatorTransportAdapter;
  admission?: AdmissionConfig;
  delegation?: DelegationConfig;
  hooks?: DelegatorHooks;
}

export const DEFAULT_ADMISSION = {
  maxTotalBytes: 100 * 1024 * 1024,      // 100MB
  maxFileCount: 10000,
  maxSingleFileBytes: 50 * 1024 * 1024,  // 50MB
  sensitivePatterns: [
    '.env', '.env.*',
    '*.pem', '*.key', '*.p12', '*.pfx',
    'id_rsa', 'id_rsa.*', 'id_ed25519', 'id_ed25519.*', 'id_ecdsa', 'id_ecdsa.*',
    'credentials.json', 'service-account*.json',
    '.npmrc', '.pypirc',
  ],
} as const;

export const DEFAULT_DELEGATION = {
  lease: {
    ttlSeconds: 3600,
    accessMode: 'rw' as AccessMode,
  },
  snapshot: {
    mode: 'auto' as SnapshotMode,
    retentionMs: 30 * 60 * 1000,           // 30 minutes
    maxSnapshots: 10,
  },
  connection: {
    requestTimeout: 30000,                  // 30 seconds
    sseMaxRetries: 3,
    sseRetryDelayMs: 2000,                  // 2s × retryCount (linear backoff)
  },
} as const;

export interface ResolvedDelegationConfig {
  lease: Required<NonNullable<DelegationConfig['lease']>>;
  snapshot: Required<NonNullable<DelegationConfig['snapshot']>>;
  connection: Required<NonNullable<DelegationConfig['connection']>>;
}

export interface ResolvedDelegatorConfig {
  baseDir: string;
  transport: DelegatorTransportAdapter;
  admission: Required<AdmissionConfig>;
  delegation: ResolvedDelegationConfig;
  hooks: DelegatorHooks;
}

export function resolveDelegatorConfig(config: DelegatorConfig): ResolvedDelegatorConfig {
  return {
    baseDir: config.baseDir,
    transport: config.transport,
    admission: {
      maxTotalBytes: config.admission?.maxTotalBytes ?? DEFAULT_ADMISSION.maxTotalBytes,
      maxFileCount: config.admission?.maxFileCount ?? DEFAULT_ADMISSION.maxFileCount,
      maxSingleFileBytes: config.admission?.maxSingleFileBytes ?? DEFAULT_ADMISSION.maxSingleFileBytes,
      sensitivePatterns: config.admission?.sensitivePatterns ?? [...DEFAULT_ADMISSION.sensitivePatterns],
      skipSensitiveCheck: config.admission?.skipSensitiveCheck ?? false,
    },
    delegation: {
      lease: {
        ttlSeconds: config.delegation?.lease?.ttlSeconds ?? DEFAULT_DELEGATION.lease.ttlSeconds,
        accessMode: config.delegation?.lease?.accessMode ?? DEFAULT_DELEGATION.lease.accessMode,
      },
      snapshot: {
        mode: config.delegation?.snapshot?.mode ?? DEFAULT_DELEGATION.snapshot.mode,
        retentionMs: config.delegation?.snapshot?.retentionMs ?? DEFAULT_DELEGATION.snapshot.retentionMs,
        maxSnapshots: config.delegation?.snapshot?.maxSnapshots ?? DEFAULT_DELEGATION.snapshot.maxSnapshots,
      },
      connection: {
        requestTimeout: config.delegation?.connection?.requestTimeout ?? DEFAULT_DELEGATION.connection.requestTimeout,
        sseMaxRetries: config.delegation?.connection?.sseMaxRetries ?? DEFAULT_DELEGATION.connection.sseMaxRetries,
        sseRetryDelayMs: config.delegation?.connection?.sseRetryDelayMs ?? DEFAULT_DELEGATION.connection.sseRetryDelayMs,
      },
    },
    hooks: config.hooks ?? {},
  };
}

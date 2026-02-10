/**
 * AWCP Delegator Configuration
 */

import type { Delegation, AccessMode, DelegatorTransportAdapter, SnapshotPolicy, EnvironmentSnapshot } from '@awcp/core';
import type { AdmissionConfig } from './admission.js';

// Re-export for convenience
export type { AdmissionConfig } from './admission.js';

export interface SnapshotConfig {
  mode?: SnapshotPolicy;
  retentionMs?: number;
  maxSnapshots?: number;
}

export interface DelegationConfig {
  ttlSeconds?: number;
  accessMode?: AccessMode;
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
  snapshot?: SnapshotConfig;
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

export const DEFAULT_SNAPSHOT = {
  mode: 'auto' as SnapshotPolicy,
  retentionMs: 30 * 60 * 1000,           // 30 minutes
  maxSnapshots: 10,
} as const;

export const DEFAULT_DELEGATION = {
  ttlSeconds: 3600,
  accessMode: 'rw' as AccessMode,
} as const;

export interface ResolvedDelegatorConfig {
  baseDir: string;
  transport: DelegatorTransportAdapter;
  admission: Required<AdmissionConfig>;
  snapshot: Required<SnapshotConfig>;
  delegation: Required<DelegationConfig>;
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
    snapshot: {
      mode: config.snapshot?.mode ?? DEFAULT_SNAPSHOT.mode,
      retentionMs: config.snapshot?.retentionMs ?? DEFAULT_SNAPSHOT.retentionMs,
      maxSnapshots: config.snapshot?.maxSnapshots ?? DEFAULT_SNAPSHOT.maxSnapshots,
    },
    delegation: {
      ttlSeconds: config.delegation?.ttlSeconds ?? DEFAULT_DELEGATION.ttlSeconds,
      accessMode: config.delegation?.accessMode ?? DEFAULT_DELEGATION.accessMode,
    },
    hooks: config.hooks ?? {},
  };
}

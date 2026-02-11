/**
 * Git Transport Configuration Types
 */

import type { GitCredential } from '@awcp/core';

export interface GitDelegatorTransportConfig {
  remoteUrl: string;
  auth: GitCredential;
  tempDir?: string;
  deleteRemoteBranch?: boolean;
}

export interface GitExecutorTransportConfig {
  tempDir?: string;
  branchPrefix?: string;
}

export interface GitSnapshotInfo {
  branch: string;
  commitHash: string;
  baseCommit: string;
  changedFiles: string[];
}

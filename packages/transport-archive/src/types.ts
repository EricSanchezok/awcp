/**
 * Archive Transport Configuration Types
 */

export { ArchiveWorkDirInfo } from '@awcp/core';

/**
 * Delegator-side configuration for archive transport
 */
export interface ArchiveDelegatorConfig {
  /** Directory for storing temporary archive files */
  tempDir?: string;
}

/**
 * Executor-side configuration for archive transport
 */
export interface ArchiveExecutorConfig {
  /** Directory for storing temporary archives */
  tempDir?: string;
}

/**
 * Combined configuration for ArchiveTransport
 */
export interface ArchiveTransportConfig {
  delegator?: ArchiveDelegatorConfig;
  executor?: ArchiveExecutorConfig;
}

/**
 * Result from creating an archive
 */
export interface ArchiveCreateResult {
  archivePath: string;
  checksum: string;
  sizeBytes: number;
  base64: string;
}

/**
 * Transport Adapter Interface
 *
 * Abstract interface that all transport implementations must implement.
 * This enables pluggable transports (sshfs, archive, webdav, etc.)
 */

import type { TransportType, MountInfo } from './messages.js';

/**
 * Parameters for preparing a transport on Delegator side
 */
export interface TransportPrepareParams {
  /** Unique delegation identifier */
  delegationId: string;
  /** Path to the export directory on Delegator */
  exportPath: string;
  /** Time-to-live in seconds */
  ttlSeconds: number;
}

/**
 * Result from transport preparation
 */
export interface TransportPrepareResult {
  /** Mount information to include in START message */
  mountInfo: MountInfo;
}

/**
 * Parameters for setting up workspace on Executor side
 */
export interface TransportSetupParams {
  /** Unique delegation identifier */
  delegationId: string;
  /** Mount information from START message */
  mountInfo: MountInfo;
  /** Target directory for workspace (Executor decides this) */
  targetDir: string;
}

/**
 * Parameters for tearing down workspace on Executor side
 */
export interface TransportTeardownParams {
  /** Unique delegation identifier */
  delegationId: string;
  /** Working directory that was set up */
  workDir: string;
}

/**
 * Dependency check result
 */
export interface DependencyCheckResult {
  /** Whether the transport dependencies are available */
  available: boolean;
  /** Optional hint for installation if not available */
  hint?: string;
}

/**
 * Transport Adapter Interface
 *
 * All transport implementations (sshfs, archive, etc.) must implement this interface.
 * The SDK uses this abstraction to remain transport-agnostic.
 *
 * Lifecycle:
 * - Delegator: prepare() -> [task runs] -> cleanup()
 * - Executor: checkDependency() -> setup() -> [task runs] -> teardown()
 */
export interface TransportAdapter {
  /** Transport type identifier */
  readonly type: TransportType;

  // ========== Delegator Side ==========

  /**
   * Prepare the transport for a delegation.
   * Called after ACCEPT received, before sending START.
   *
   * For SSHFS: Generate SSH credentials, prepare endpoint info
   * For Archive: Create zip, start file server, generate URLs
   *
   * @param params Preparation parameters
   * @returns Mount information to include in START message
   */
  prepare(params: TransportPrepareParams): Promise<TransportPrepareResult>;

  /**
   * Clean up resources for a delegation.
   * Called after DONE/ERROR received or on expiration.
   *
   * For SSHFS: Revoke SSH credentials
   * For Archive: Remove temporary files, stop serving
   *
   * @param delegationId The delegation to clean up
   */
  cleanup(delegationId: string): Promise<void>;

  // ========== Executor Side ==========

  /**
   * Check if transport dependencies are available.
   * Called during INVITE handling.
   *
   * For SSHFS: Check if sshfs binary is installed
   * For Archive: Usually always available (just needs Node.js)
   *
   * @returns Availability status and installation hint
   */
  checkDependency(): Promise<DependencyCheckResult>;

  /**
   * Set up the workspace for task execution.
   * Called after START received.
   *
   * For SSHFS: Mount remote filesystem
   * For Archive: Download and extract archive
   *
   * @param params Setup parameters including mount info from START
   * @returns Path to the working directory (may differ from targetDir)
   */
  setup(params: TransportSetupParams): Promise<string>;

  /**
   * Tear down the workspace after task completion.
   * Called before sending DONE/ERROR.
   *
   * For SSHFS: Unmount filesystem
   * For Archive: Package results for upload (if needed)
   *
   * @param params Teardown parameters
   */
  teardown(params: TransportTeardownParams): Promise<void>;
}

/**
 * Transport adapter for Delegator side only.
 * Use this when implementing a transport that only needs Delegator functionality.
 */
export interface DelegatorTransportAdapter {
  readonly type: TransportType;
  prepare(params: TransportPrepareParams): Promise<TransportPrepareResult>;
  cleanup(delegationId: string): Promise<void>;
}

/**
 * Transport adapter for Executor side only.
 * Use this when implementing a transport that only needs Executor functionality.
 */
export interface ExecutorTransportAdapter {
  readonly type: TransportType;
  checkDependency(): Promise<DependencyCheckResult>;
  setup(params: TransportSetupParams): Promise<string>;
  teardown(params: TransportTeardownParams): Promise<void>;
}

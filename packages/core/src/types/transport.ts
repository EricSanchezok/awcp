/**
 * Transport Adapter Interface
 *
 * Abstract interface that all transport implementations must implement.
 * This enables pluggable transports (sshfs, archive, webdav, etc.)
 */

import type { TransportType, WorkDirInfo } from './messages.js';

/**
 * Parameters for preparing a transport on Delegator side
 */
export interface TransportPrepareParams {
  delegationId: string;
  exportPath: string;
  ttlSeconds: number;
}

/**
 * Result from transport preparation
 */
export interface TransportPrepareResult {
  workDirInfo: WorkDirInfo;
}

/**
 * Parameters for setting up workspace on Executor side
 */
export interface TransportSetupParams {
  delegationId: string;
  workDirInfo: WorkDirInfo;
  workDir: string;
}

/**
 * Parameters for tearing down workspace on Executor side
 */
export interface TransportTeardownParams {
  delegationId: string;
  workDir: string;
}

/**
 * Result from transport teardown (optional result data)
 */
export interface TransportTeardownResult {
  resultBase64?: string;
}

/**
 * Dependency check result
 */
export interface DependencyCheckResult {
  available: boolean;
  hint?: string;
}

/**
 * Transport Adapter Interface
 *
 * All transport implementations (sshfs, archive, etc.) must implement this interface.
 *
 * Lifecycle:
 * - Delegator: prepare() -> [task runs] -> cleanup()
 * - Executor: checkDependency() -> setup() -> [task runs] -> teardown()
 */
export interface TransportAdapter {
  readonly type: TransportType;

  // ========== Delegator Side ==========

  /**
   * Prepare the transport for a delegation.
   * Called after ACCEPT received, before sending START.
   */
  prepare(params: TransportPrepareParams): Promise<TransportPrepareResult>;

  /**
   * Clean up resources for a delegation.
   * Called after task completion or on expiration.
   */
  cleanup(delegationId: string): Promise<void>;

  // ========== Executor Side ==========

  /**
   * Check if transport dependencies are available.
   */
  checkDependency(): Promise<DependencyCheckResult>;

  /**
   * Set up the workspace for task execution.
   * Called after START received.
   */
  setup(params: TransportSetupParams): Promise<string>;

  /**
   * Tear down the workspace after task completion.
   */
  teardown(params: TransportTeardownParams): Promise<TransportTeardownResult>;
}

/**
 * Transport adapter for Delegator side only
 */
export interface DelegatorTransportAdapter {
  readonly type: TransportType;
  prepare(params: TransportPrepareParams): Promise<TransportPrepareResult>;
  cleanup(delegationId: string): Promise<void>;
}

/**
 * Transport adapter for Executor side only
 */
export interface ExecutorTransportAdapter {
  readonly type: TransportType;
  checkDependency(): Promise<DependencyCheckResult>;
  setup(params: TransportSetupParams): Promise<string>;
  teardown(params: TransportTeardownParams): Promise<TransportTeardownResult>;
}

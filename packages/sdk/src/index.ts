/**
 * @awcp/sdk
 * 
 * AWCP SDK - Host and Remote Daemon implementations
 */

// Host-side exports
export {
  HostDaemon,
  type HostDaemonConfig,
  type HostDaemonEvents,
  AdmissionController,
  type AdmissionConfig,
  type AdmissionResult,
  type WorkspaceStats,
  ExportViewManager,
  type ExportConfig,
} from './host/index.js';

// Remote-side exports
export {
  RemoteDaemon,
  type RemoteDaemonConfig,
  type RemoteDaemonEvents,
  LocalPolicy,
  type PolicyConfig,
  type MountPointValidation,
} from './remote/index.js';

// Re-export core types for convenience
export * from '@awcp/core';

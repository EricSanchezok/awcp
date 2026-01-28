/**
 * @awcp/sdk
 * 
 * AWCP SDK - Host and Remote Daemon implementations
 */

// ============================================
// High-level API (recommended for most users)
// ============================================

// Remote-side: Enable AWCP support in an A2A agent
export {
  AwcpRemoteService,
  type AwcpRemoteServiceOptions,
  type ServiceStatus,
  type AwcpRemoteConfig,
  type MountConfig,
  type PolicyConstraints,
  type AwcpHooks,
} from './remote/index.js';

// ============================================
// Low-level API (for advanced use)
// ============================================

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

// Remote-side low-level exports
export {
  RemoteDaemon,
  type RemoteDaemonConfig,
  type RemoteDaemonEvents,
  LocalPolicy,
  type PolicyConfig,
  type MountPointValidation,
  HostClient,
} from './remote/index.js';

// Re-export core types for convenience
export * from '@awcp/core';

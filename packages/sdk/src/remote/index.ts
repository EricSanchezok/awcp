// High-level API (recommended)
export { AwcpRemoteService, type AwcpRemoteServiceOptions, type ServiceStatus } from './service.js';
export {
  type AwcpRemoteConfig,
  type MountConfig,
  type PolicyConstraints,
  type AwcpHooks,
  type ResolvedAwcpRemoteConfig,
  DEFAULT_CONFIG,
  resolveConfig,
} from './config.js';

// Low-level API (for advanced use)
export { RemoteDaemon, type RemoteDaemonConfig, type RemoteDaemonEvents } from './daemon.js';
export { LocalPolicy, type PolicyConfig, type MountPointValidation } from './policy.js';
export { HostClient } from './host-client.js';

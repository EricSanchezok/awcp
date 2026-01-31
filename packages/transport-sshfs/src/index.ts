/**
 * @awcp/transport-sshfs
 * 
 * SSHFS Transport implementation for AWCP data plane
 */

// Main transport adapter
export { SshfsTransport } from './sshfs-transport.js';

// Types
export type {
  SshfsTransportConfig,
  SshfsDelegatorConfig,
  SshfsExecutorConfig,
  CredentialManagerConfig,
  GeneratedCredential,
  SshfsMountConfig,
  MountParams,
  ActiveMount,
  SshfsWorkDirInfo,
  SshCredential,
  SshEndpoint,
} from './types.js';

// Lower-level components (for advanced use cases)
export { CredentialManager } from './delegator/index.js';
export { SshfsMountClient, DEFAULT_TEMP_KEY_DIR, buildSshfsArgs } from './executor/index.js';

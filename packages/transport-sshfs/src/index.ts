/**
 * @awcp/transport-sshfs
 * 
 * SSHFS Transport implementation for AWCP data plane
 */

// Main transport adapter
export { SshfsTransport, type SshfsTransportConfig } from './sshfs-transport.js';

// Lower-level components (for advanced use cases)
export {
  CredentialManager,
  type CredentialManagerConfig,
  type GeneratedCredential,
} from './delegator/index.js';

export {
  SshfsMountClient,
  type SshfsMountConfig,
  type MountParams,
} from './executor/index.js';

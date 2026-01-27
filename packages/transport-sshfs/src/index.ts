/**
 * @awcp/transport-sshfs
 * 
 * SSHFS Transport implementation for AWCP data plane
 */

// Host-side exports
export {
  CredentialManager,
  type CredentialManagerConfig,
  type GeneratedCredential,
} from './host/index.js';

// Remote-side exports
export {
  SshfsMountClient,
  type SshfsMountConfig,
  type MountParams,
} from './remote/index.js';

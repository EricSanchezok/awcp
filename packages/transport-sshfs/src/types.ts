/**
 * SSHFS Transport Configuration Types
 */

export { SshfsMountInfo, SshCredential, SshEndpoint } from '@awcp/core';

/**
 * Delegator-side configuration for SSHFS transport
 */
export interface SshfsDelegatorConfig {
  /** Directory to store temporary keys (default: ~/.awcp/keys) */
  keyDir?: string;

  /** Path to CA private key for signing certificates */
  caKeyPath: string;

  /** SSH server host (default: localhost) */
  host?: string;

  /** SSH server port (default: 22) */
  port?: number;

  /** SSH user for connections */
  user?: string;
}

/**
 * Executor-side configuration for SSHFS transport
 */
export interface SshfsExecutorConfig {
  /** Directory to store temporary key files (default: /tmp/awcp/client-keys) */
  tempKeyDir?: string;

  /** Additional sshfs mount options */
  defaultMountOptions?: Record<string, string>;

  /** Timeout for mount operation in milliseconds (default: 30000) */
  mountTimeout?: number;
}

/**
 * Combined configuration for SshfsTransport
 */
export interface SshfsTransportConfig {
  /** Delegator-side configuration */
  delegator?: SshfsDelegatorConfig;

  /** Executor-side configuration */
  executor?: SshfsExecutorConfig;
}

/**
 * Credential Manager configuration
 */
export interface CredentialManagerConfig {
  /** Directory to store temporary keys (default: ~/.awcp/keys) */
  keyDir?: string;

  /** Path to CA private key for signing certificates */
  caKeyPath: string;

  /** SSH server host (default: localhost) */
  sshHost?: string;

  /** SSH server port (default: 22) */
  sshPort?: number;

  /** SSH user for connections */
  sshUser?: string;
}

/**
 * Generated credential info
 */
export interface GeneratedCredential {
  /** The private key content */
  privateKey: string;

  /** Path to the private key file */
  privateKeyPath: string;

  /** Path to the public key file */
  publicKeyPath: string;

  /** Path to the certificate file */
  certPath: string;

  /** Delegation ID for tracking */
  delegationId: string;
}

/**
 * SSHFS Mount Client configuration
 */
export interface SshfsMountConfig {
  /** Directory to store temporary key files */
  tempKeyDir?: string;

  /** Additional sshfs options */
  defaultOptions?: Record<string, string>;

  /** Timeout for mount operation in ms (default: 30000) */
  mountTimeout?: number;
}

/**
 * Mount parameters for SSHFS
 */
export interface MountParams {
  /** SSH endpoint */
  endpoint: {
    host: string;
    port: number;
    user: string;
  };

  /** Remote path or export locator */
  exportLocator: string;

  /** SSH credential (private key + certificate) */
  credential: {
    privateKey: string;
    certificate: string;
  };

  /** Local mount point path */
  mountPoint: string;

  /** Additional mount options */
  options?: Record<string, string>;
}

/**
 * Active mount tracking info
 */
export interface ActiveMount {
  /** Local mount point path */
  mountPoint: string;

  /** Path to temporary private key file */
  keyPath: string;

  /** Path to temporary certificate file */
  certPath: string;
}

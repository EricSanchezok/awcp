/**
 * AWCP Protocol Version
 */
export const PROTOCOL_VERSION = '1' as const;

/**
 * Message Types for AWCP Protocol
 */
export type MessageType = 'INVITE' | 'ACCEPT' | 'START' | 'DONE' | 'ERROR';

/**
 * Access modes for workspace delegation
 */
export type AccessMode = 'ro' | 'rw';

/**
 * Transport types for data plane
 */
export type TransportType = 'sshfs';

/**
 * Delegation lifecycle states
 */
export type DelegationState =
  | 'created'
  | 'invited'
  | 'accepted'
  | 'started'
  | 'running'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'expired';

/**
 * Task description for delegation
 */
export interface TaskSpec {
  /** Short description for logging/listing */
  description: string;
  /** Full task prompt with goals and constraints */
  prompt: string;
}

/**
 * Lease configuration
 */
export interface LeaseConfig {
  /** Time-to-live in seconds */
  ttlSeconds: number;
  /** Access mode */
  accessMode: AccessMode;
}

/**
 * Active lease information (after START)
 */
export interface ActiveLease {
  /** Absolute expiration time (ISO 8601) */
  expiresAt: string;
  /** Effective access mode */
  accessMode: AccessMode;
}

/**
 * Workspace specification in INVITE
 */
export interface WorkspaceSpec {
  /** Logical export name (not real path), e.g., "awcp/<id>" */
  exportName: string;
}

/**
 * Requirements for Remote to check
 */
export interface Requirements {
  /** Transport type (default: sshfs) */
  transport?: TransportType;
}

/**
 * Remote mount specification in ACCEPT
 */
export interface RemoteMount {
  /** Local absolute path on Remote, determined by Remote's policy */
  mountPoint: string;
}

/**
 * Sandbox profile - capability declaration by Remote
 */
export interface SandboxProfile {
  /** Whether tools are restricted to mount point CWD */
  cwdOnly?: boolean;
  /** Whether network access is allowed */
  allowNetwork?: boolean;
  /** Whether command execution is allowed */
  allowExec?: boolean;
}

/**
 * Remote constraints in ACCEPT
 */
export interface RemoteConstraints {
  /** Actually accepted access mode (may be downgraded) */
  acceptedAccessMode?: AccessMode;
  /** Maximum TTL Remote allows */
  maxTtlSeconds?: number;
  /** Self-declared sandbox constraints */
  sandboxProfile?: SandboxProfile;
}

/**
 * SSH endpoint for SSHFS transport
 */
export interface SshEndpoint {
  host: string;
  port: number;
  user: string;
}

/**
 * Mount information in START message
 */
export interface MountInfo {
  /** Transport type */
  transport: TransportType;
  /** Connection endpoint */
  endpoint: SshEndpoint;
  /** Export path or locator token */
  exportLocator: string;
  /** Temporary credential (SSH key or token) */
  credential: string;
  /** Optional mount parameters */
  mountOptions?: Record<string, string>;
}

/**
 * Base message structure
 */
export interface BaseMessage {
  version: typeof PROTOCOL_VERSION;
  type: MessageType;
  delegationId: string;
}

/**
 * INVITE message: Host → Remote
 * Initiates collaboration request
 */
export interface InviteMessage extends BaseMessage {
  type: 'INVITE';
  task: TaskSpec;
  lease: LeaseConfig;
  workspace: WorkspaceSpec;
  requirements?: Requirements;
}

/**
 * ACCEPT message: Remote → Host
 * Confirms acceptance with mount point
 */
export interface AcceptMessage extends BaseMessage {
  type: 'ACCEPT';
  remoteMount: RemoteMount;
  remoteConstraints?: RemoteConstraints;
}

/**
 * START message: Host → Remote
 * Authorizes and provides credentials
 */
export interface StartMessage extends BaseMessage {
  type: 'START';
  lease: ActiveLease;
  mount: MountInfo;
}

/**
 * DONE message: Remote → Host
 * Reports successful completion
 */
export interface DoneMessage extends BaseMessage {
  type: 'DONE';
  /** Summary of what was accomplished */
  finalSummary: string;
  /** Files Remote suggests Host to review */
  highlights?: string[];
  /** Additional notes */
  notes?: string;
}

/**
 * ERROR message: Either direction
 * Reports failure or rejection
 */
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  /** Error code */
  code: string;
  /** Human-readable description */
  message: string;
  /** Suggested fix */
  hint?: string;
}

/**
 * Union type for all AWCP messages
 */
export type AwcpMessage =
  | InviteMessage
  | AcceptMessage
  | StartMessage
  | DoneMessage
  | ErrorMessage;

/**
 * Delegation record - full state of a delegation
 */
export interface Delegation {
  id: string;
  state: DelegationState;
  peerUrl: string;
  localDir: string;
  exportPath?: string;
  task: TaskSpec;
  leaseConfig: LeaseConfig;
  activeLease?: ActiveLease;
  remoteMount?: RemoteMount;
  remoteConstraints?: RemoteConstraints;
  result?: {
    summary: string;
    highlights?: string[];
    notes?: string;
  };
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
  createdAt: string;
  updatedAt: string;
}

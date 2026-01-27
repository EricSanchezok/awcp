/**
 * AWCP Error Codes
 * 
 * Standard error codes defined in AWCP v1 specification
 */
export const ErrorCodes = {
  /** Remote declined collaboration */
  DECLINED: 'DECLINED',
  /** Missing dependency (e.g., sshfs not installed) */
  DEP_MISSING: 'DEP_MISSING',
  /** Workspace too large for remote mount collaboration */
  WORKSPACE_TOO_LARGE: 'WORKSPACE_TOO_LARGE',
  /** Mount point denied by policy */
  MOUNTPOINT_DENIED: 'MOUNTPOINT_DENIED',
  /** Lease expired before START */
  START_EXPIRED: 'START_EXPIRED',
  /** Lease expired during execution */
  EXPIRED: 'EXPIRED',
  /** Authentication failed */
  AUTH_FAILED: 'AUTH_FAILED',
  /** Mount operation failed */
  MOUNT_FAILED: 'MOUNT_FAILED',
  /** Task execution failed */
  TASK_FAILED: 'TASK_FAILED',
  /** Cancelled by user or system */
  CANCELLED: 'CANCELLED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Base class for AWCP errors
 */
export class AwcpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly hint?: string,
    public readonly delegationId?: string,
  ) {
    super(message);
    this.name = 'AwcpError';
  }

  toErrorMessage() {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
    };
  }
}

/**
 * Error: Remote declined the collaboration
 */
export class DeclinedError extends AwcpError {
  constructor(message: string, hint?: string, delegationId?: string) {
    super(ErrorCodes.DECLINED, message, hint, delegationId);
    this.name = 'DeclinedError';
  }
}

/**
 * Error: Missing required dependency
 */
export class DependencyMissingError extends AwcpError {
  constructor(
    public readonly dependency: string,
    hint?: string,
    delegationId?: string,
  ) {
    super(
      ErrorCodes.DEP_MISSING,
      `Missing required dependency: ${dependency}`,
      hint ?? `Please install ${dependency} and try again`,
      delegationId,
    );
    this.name = 'DependencyMissingError';
  }
}

/**
 * Error: Workspace too large
 */
export class WorkspaceTooLargeError extends AwcpError {
  constructor(
    public readonly stats: {
      estimatedBytes?: number;
      fileCount?: number;
      largestFileBytes?: number;
    },
    hint?: string,
    delegationId?: string,
  ) {
    super(
      ErrorCodes.WORKSPACE_TOO_LARGE,
      'Workspace exceeds size limits for remote mount collaboration',
      hint ?? 'Consider selecting a smaller subdirectory or excluding large files',
      delegationId,
    );
    this.name = 'WorkspaceTooLargeError';
  }
}

/**
 * Error: Mount point denied by policy
 */
export class MountPointDeniedError extends AwcpError {
  constructor(mountPoint: string, hint?: string, delegationId?: string) {
    super(
      ErrorCodes.MOUNTPOINT_DENIED,
      `Mount point denied by policy: ${mountPoint}`,
      hint,
      delegationId,
    );
    this.name = 'MountPointDeniedError';
  }
}

/**
 * Error: Mount operation failed
 */
export class MountFailedError extends AwcpError {
  constructor(reason: string, hint?: string, delegationId?: string) {
    super(
      ErrorCodes.MOUNT_FAILED,
      `Mount failed: ${reason}`,
      hint,
      delegationId,
    );
    this.name = 'MountFailedError';
  }
}

/**
 * Error: Task execution failed
 */
export class TaskFailedError extends AwcpError {
  constructor(reason: string, hint?: string, delegationId?: string) {
    super(
      ErrorCodes.TASK_FAILED,
      `Task failed: ${reason}`,
      hint,
      delegationId,
    );
    this.name = 'TaskFailedError';
  }
}

/**
 * Error: Lease expired
 */
export class LeaseExpiredError extends AwcpError {
  constructor(
    duringStart: boolean = false,
    delegationId?: string,
  ) {
    super(
      duringStart ? ErrorCodes.START_EXPIRED : ErrorCodes.EXPIRED,
      duringStart
        ? 'Lease expired before START message was received'
        : 'Lease expired during task execution',
      undefined,
      delegationId,
    );
    this.name = 'LeaseExpiredError';
  }
}

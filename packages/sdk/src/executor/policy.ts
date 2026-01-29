import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Local policy configuration
 */
export interface PolicyConfig {
  /** Base directory for mount points (default: /tmp/awcp/mounts) */
  mountRoot?: string;
  /** Maximum concurrent delegations */
  maxConcurrent?: number;
}

// TODO [Security]: Consider adding optional forbidden paths if needed in the future.
// Current security model relies on:
// 1. User explicitly configures mount.root (user takes responsibility)
// 2. startsWith(root) check prevents path traversal attacks
// 3. SSHFS mounts run at user-level (no privilege escalation)

/**
 * Mount point validation result
 */
export interface MountPointValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Default mount root directory
 */
const DEFAULT_MOUNT_ROOT = '/tmp/awcp/mounts';

/**
 * Local Policy
 * 
 * Enforces security constraints on the Executor side.
 * Determines mount points and validates they are safe.
 * 
 * TODO [Security]: Current security model:
 * - User explicitly configures mount.root (user takes responsibility)
 * - startsWith(root) check prevents path traversal attacks from malicious delegationId
 * - SSHFS mounts run at user-level (no privilege escalation possible)
 * 
 * Future considerations:
 * - Add optional allowlist/denylist for extra protection in managed environments
 * - Add audit logging for mount operations
 * - Consider sandboxing options (e.g., namespaces on Linux)
 */
export class LocalPolicy {
  private config: PolicyConfig;
  private allocatedMounts = new Set<string>();

  constructor(config?: PolicyConfig) {
    this.config = config ?? {};
  }

  /**
   * Allocate a mount point for a delegation
   * 
   * The mount point is always under the configured mount root,
   * preventing any attacker-controlled paths.
   */
  allocateMountPoint(delegationId: string): string {
    const root = this.config.mountRoot ?? DEFAULT_MOUNT_ROOT;
    const mountPoint = join(root, delegationId);
    this.allocatedMounts.add(mountPoint);
    return mountPoint;
  }

  /**
   * Validate that a mount point is safe to use
   * 
   * TODO [Security]: Currently only checks path traversal.
   * Consider adding audit logging here for security monitoring.
   */
  async validateMountPoint(mountPoint: string): Promise<MountPointValidation> {
    const root = this.config.mountRoot ?? DEFAULT_MOUNT_ROOT;

    // Must be under mount root (prevents path traversal attacks)
    if (!mountPoint.startsWith(root)) {
      return {
        valid: false,
        reason: `Mount point must be under ${root}`,
      };
    }

    // TODO [Security]: Consider checking if path contains suspicious patterns
    // like symlinks pointing outside root, or special files

    return { valid: true };
  }

  /**
   * Prepare a mount point for use
   * 
   * Creates the directory if needed and ensures it's empty.
   */
  async prepareMountPoint(mountPoint: string): Promise<void> {
    // Create directory
    await mkdir(mountPoint, { recursive: true });

    // Check if empty
    const entries = await readdir(mountPoint);
    if (entries.length > 0) {
      throw new Error(
        `Mount point ${mountPoint} is not empty. ` +
        `Found ${entries.length} entries. ` +
        `Refusing to mount to prevent data occlusion.`
      );
    }
  }

  /**
   * Release a mount point
   */
  releaseMountPoint(mountPoint: string): void {
    this.allocatedMounts.delete(mountPoint);
  }

  /**
   * Check if concurrent limit is reached
   */
  canAcceptMore(): boolean {
    const max = this.config.maxConcurrent ?? Infinity;
    return this.allocatedMounts.size < max;
  }

  /**
   * Get currently allocated mount points
   */
  getAllocatedMounts(): string[] {
    return Array.from(this.allocatedMounts);
  }
}

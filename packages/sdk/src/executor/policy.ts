import { mkdir, readdir, rm } from 'node:fs/promises';
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

// TODO [Security]: Consider optional forbidden paths for managed environments

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
 * Local Policy - Enforces security constraints on the Executor side.
 * 
 * Security: startsWith(root) check prevents path traversal attacks.
 */
export class LocalPolicy {
  private config: PolicyConfig;
  private allocatedMounts = new Set<string>();

  constructor(config?: PolicyConfig) {
    this.config = config ?? {};
  }

  /**
   * Allocate a mount point for a delegation
   */
  allocateMountPoint(delegationId: string): string {
    const root = this.config.mountRoot ?? DEFAULT_MOUNT_ROOT;
    const mountPoint = join(root, delegationId);
    this.allocatedMounts.add(mountPoint);
    return mountPoint;
  }

  /**
   * Validate that a mount point is safe to use
   */
  async validateMountPoint(mountPoint: string): Promise<MountPointValidation> {
    const root = this.config.mountRoot ?? DEFAULT_MOUNT_ROOT;

    if (!mountPoint.startsWith(root)) {
      return {
        valid: false,
        reason: `Mount point must be under ${root}`,
      };
    }

    return { valid: true };
  }

  /**
   * Prepare a mount point (create directory, ensure empty)
   */
  async prepareMountPoint(mountPoint: string): Promise<void> {
    await mkdir(mountPoint, { recursive: true });

    const entries = await readdir(mountPoint);
    if (entries.length > 0) {
      throw new Error(`Mount point ${mountPoint} is not empty`);
    }
  }

  /**
   * Release a mount point and remove the directory
   */
  async releaseMountPoint(mountPoint: string): Promise<void> {
    this.allocatedMounts.delete(mountPoint);
    try {
      await rm(mountPoint, { recursive: true, force: true });
    } catch {
      // Ignore errors - directory may already be gone
    }
  }

  /**
   * Cleanup stale mount directories from previous runs
   */
  async cleanupStaleMounts(): Promise<number> {
    const root = this.config.mountRoot ?? DEFAULT_MOUNT_ROOT;
    let cleaned = 0;

    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const mountPath = join(root, entry.name);
          // Only clean directories not currently allocated
          if (!this.allocatedMounts.has(mountPath)) {
            await rm(mountPath, { recursive: true, force: true });
            cleaned++;
          }
        }
      }
    } catch {
      // Root directory may not exist yet
    }

    return cleaned;
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

/**
 * Workspace Manager - manages workspace directories on Executor side
 */

import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface WorkspaceValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Manages workspace allocation, preparation, and cleanup.
 */
export class WorkspaceManager {
  private workDir: string;
  private allocated = new Set<string>();

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  /** Allocate a workspace path for a delegation */
  allocate(delegationId: string): string {
    const path = join(this.workDir, delegationId);
    this.allocated.add(path);
    return path;
  }

  /** Validate that a workspace path is safe to use */
  validate(path: string): WorkspaceValidation {
    if (!path.startsWith(this.workDir)) {
      return { valid: false, reason: `Path must be under ${this.workDir}` };
    }
    return { valid: true };
  }

  /** Prepare a workspace directory */
  async prepare(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
    const entries = await readdir(path);
    if (entries.length > 0) {
      throw new Error(`Workspace ${path} is not empty`);
    }
  }

  /** Release a workspace and remove the directory */
  async release(path: string): Promise<void> {
    this.allocated.delete(path);
    try {
      await rm(path, { recursive: true, force: true });
    } catch {
      // Ignore errors - directory may already be gone
    }
  }

  /** Cleanup stale workspace directories from previous runs */
  async cleanupStale(): Promise<number> {
    let cleaned = 0;
    try {
      const entries = await readdir(this.workDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const path = join(this.workDir, entry.name);
          if (!this.allocated.has(path)) {
            await rm(path, { recursive: true, force: true });
            cleaned++;
          }
        }
      }
    } catch {
      // Root directory may not exist yet
    }
    return cleaned;
  }

  /** Check if a path is currently allocated */
  isAllocated(path: string): boolean {
    return this.allocated.has(path);
  }

  /** Get all currently allocated paths */
  getAllocated(): string[] {
    return Array.from(this.allocated);
  }
}

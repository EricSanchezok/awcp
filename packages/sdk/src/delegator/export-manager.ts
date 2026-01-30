/**
 * Export Manager - manages export directories on Delegator side
 */

import { mkdir, rm, symlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExportConfig } from './config.js';

const DEFAULT_EXPORT_BASE = '/tmp/awcp/exports';

/**
 * Manages export directory allocation and cleanup.
 */
export class ExportManager {
  private baseDir: string;
  private strategy: 'symlink' | 'bind' | 'worktree';
  private exports = new Map<string, string>();

  constructor(config?: ExportConfig) {
    this.baseDir = config?.baseDir ?? DEFAULT_EXPORT_BASE;
    this.strategy = config?.strategy ?? 'symlink';
  }

  /**
   * Allocate an export path for a delegation.
   * Returns path with trailing slash for SSHFS symlink compatibility.
   */
  async allocate(delegationId: string, localDir: string): Promise<string> {
    const exportPath = join(this.baseDir, delegationId, 'workspace');

    await mkdir(join(this.baseDir, delegationId), { recursive: true });

    switch (this.strategy) {
      case 'symlink':
        await symlink(localDir, exportPath);
        break;
      case 'bind':
        // Not implemented, fallback to symlink
        await symlink(localDir, exportPath);
        break;
      case 'worktree':
        // Not implemented, fallback to symlink
        await symlink(localDir, exportPath);
        break;
    }

    this.exports.set(delegationId, exportPath);

    // Trailing slash for SSHFS symlink compatibility
    // See: https://github.com/libfuse/sshfs/issues/312
    return exportPath + '/';
  }

  /** Release an export and remove the directory */
  async release(delegationId: string): Promise<void> {
    const exportPath = this.exports.get(delegationId);
    if (!exportPath) return;

    try {
      const delegationDir = join(this.baseDir, delegationId);
      await rm(delegationDir, { recursive: true, force: true });
      this.exports.delete(delegationId);
    } catch (error) {
      console.error(`Failed to release export for ${delegationId}:`, error);
    }
  }

  /** Get the export path for a delegation */
  getPath(delegationId: string): string | undefined {
    return this.exports.get(delegationId);
  }

  /** Release all exports */
  async releaseAll(): Promise<void> {
    for (const delegationId of this.exports.keys()) {
      await this.release(delegationId);
    }
  }

  /** Cleanup stale export directories from previous runs */
  async cleanupStale(): Promise<number> {
    let cleaned = 0;
    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !this.exports.has(entry.name)) {
          await rm(join(this.baseDir, entry.name), { recursive: true, force: true });
          cleaned++;
        }
      }
    } catch {
      // Base directory may not exist yet
    }
    return cleaned;
  }
}

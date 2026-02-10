/**
 * Snapshot Manager - manages snapshot storage on disk
 */

import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanupStaleDirectories } from '../utils/index.js';

export interface SnapshotManagerConfig {
  baseDir: string;
}

export interface StoredSnapshotMetadata {
  snapshotId: string;
  delegationId: string;
  summary: string;
  highlights?: string[];
  createdAt: string;
  [key: string]: unknown;
}

export class SnapshotManager {
  private baseDir: string;

  constructor(config: SnapshotManagerConfig) {
    this.baseDir = config.baseDir;
  }

  async save(
    delegationId: string,
    snapshotId: string,
    snapshotBase64: string,
    metadata: { summary: string; highlights?: string[]; [key: string]: unknown }
  ): Promise<string> {
    const snapshotDir = join(this.baseDir, delegationId, snapshotId);
    await mkdir(snapshotDir, { recursive: true });

    const buffer = Buffer.from(snapshotBase64, 'base64');
    const zipPath = join(snapshotDir, 'snapshot.zip');
    await writeFile(zipPath, buffer);

    const metadataPath = join(snapshotDir, 'metadata.json');
    const storedMetadata: StoredSnapshotMetadata = {
      snapshotId,
      delegationId,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
    await writeFile(metadataPath, JSON.stringify(storedMetadata, null, 2));

    return snapshotDir;
  }

  async load(delegationId: string, snapshotId: string): Promise<Buffer> {
    const zipPath = join(this.baseDir, delegationId, snapshotId, 'snapshot.zip');
    return readFile(zipPath);
  }

  async delete(delegationId: string, snapshotId: string): Promise<void> {
    const snapshotDir = join(this.baseDir, delegationId, snapshotId);
    await rm(snapshotDir, { recursive: true, force: true });
  }

  async cleanupDelegation(delegationId: string): Promise<void> {
    const snapshotsDir = join(this.baseDir, delegationId);
    await rm(snapshotsDir, { recursive: true, force: true });
  }

  async cleanupStale(knownIds: Set<string>): Promise<number> {
    return cleanupStaleDirectories(this.baseDir, knownIds);
  }
}

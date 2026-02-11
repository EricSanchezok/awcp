/**
 * Snapshot Manager - manages snapshot lifecycle for delegations
 */

import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Delegation,
  DelegatorTransportAdapter,
  EnvironmentSnapshot,
  TaskSnapshotEvent,
} from '@awcp/core';
import { cleanupStaleDirectories } from '../utils/index.js';

export interface SnapshotManagerConfig {
  baseDir: string;
  transport: DelegatorTransportAdapter;
}

interface StoredSnapshotMetadata {
  snapshotId: string;
  delegationId: string;
  summary: string;
  highlights?: string[];
  createdAt: string;
  [key: string]: unknown;
}

export class SnapshotManager {
  private baseDir: string;
  private transport: DelegatorTransportAdapter;

  constructor(config: SnapshotManagerConfig) {
    this.baseDir = config.baseDir;
    this.transport = config.transport;
  }

  async receive(delegation: Delegation, event: TaskSnapshotEvent): Promise<EnvironmentSnapshot | null> {
    if (this.transport.capabilities.liveSync) return null;

    if (!delegation.snapshots) {
      delegation.snapshots = [];
    }

    const snapshot: EnvironmentSnapshot = {
      id: event.snapshotId,
      delegationId: delegation.id,
      summary: event.summary,
      highlights: event.highlights,
      status: 'pending',
      metadata: event.metadata,
      recommended: event.recommended,
      createdAt: new Date().toISOString(),
    };

    const policy = delegation.snapshotPolicy;
    if (policy?.mode === 'auto') {
      await this.applyViaTransport(delegation, event.snapshotBase64);
      snapshot.status = 'applied';
      snapshot.appliedAt = new Date().toISOString();
      delegation.appliedSnapshotId = event.snapshotId;
    } else if (policy?.mode === 'staged') {
      snapshot.localPath = await this.save(
        delegation.id,
        event.snapshotId,
        event.snapshotBase64,
        { summary: event.summary, highlights: event.highlights, ...event.metadata },
      );
    } else {
      snapshot.status = 'discarded';
    }

    delegation.snapshots.push(snapshot);
    delegation.updatedAt = new Date().toISOString();

    return snapshot;
  }

  async apply(delegation: Delegation, snapshotId: string): Promise<EnvironmentSnapshot> {
    const snapshot = delegation.snapshots?.find(s => s.id === snapshotId);
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);
    if (snapshot.status === 'applied') throw new Error(`Snapshot already applied: ${snapshotId}`);

    const buffer = await this.load(delegation.id, snapshotId);
    await this.applyViaTransport(delegation, buffer.toString('base64'));

    snapshot.status = 'applied';
    snapshot.appliedAt = new Date().toISOString();
    delegation.appliedSnapshotId = snapshotId;
    delegation.updatedAt = new Date().toISOString();

    return snapshot;
  }

  async discard(delegation: Delegation, snapshotId: string): Promise<void> {
    const snapshot = delegation.snapshots?.find(s => s.id === snapshotId);
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

    await this.deleteFromDisk(delegation.id, snapshotId);

    snapshot.status = 'discarded';
    snapshot.localPath = undefined;
    delegation.updatedAt = new Date().toISOString();
  }

  async cleanupDelegation(delegationId: string): Promise<void> {
    const snapshotsDir = join(this.baseDir, delegationId);
    await rm(snapshotsDir, { recursive: true, force: true });
  }

  async cleanupStale(knownIds: Set<string>): Promise<number> {
    return cleanupStaleDirectories(this.baseDir, knownIds);
  }

  private async applyViaTransport(delegation: Delegation, snapshotData: string): Promise<void> {
    if (!delegation.exportPath) return;

    const rwResources = delegation.environment.resources.filter(r => r.mode === 'rw');
    if (rwResources.length === 0) return;

    try {
      if (this.transport.applySnapshot) {
        await this.transport.applySnapshot({
          delegationId: delegation.id,
          snapshotData,
          resources: rwResources.map(r => ({ name: r.name, source: r.source, mode: r.mode })),
        });
        console.log(`[AWCP:Delegator] Applied snapshot for ${delegation.id}`);
      }
    } catch (error) {
      console.error(`[AWCP:Delegator] Failed to apply snapshot for ${delegation.id}:`, error);
    }
  }

  private async save(
    delegationId: string,
    snapshotId: string,
    snapshotBase64: string,
    metadata: { summary: string; highlights?: string[]; [key: string]: unknown },
  ): Promise<string> {
    const snapshotDir = join(this.baseDir, delegationId, snapshotId);
    await mkdir(snapshotDir, { recursive: true });

    const buffer = Buffer.from(snapshotBase64, 'base64');
    await writeFile(join(snapshotDir, 'snapshot.zip'), buffer);

    const storedMetadata: StoredSnapshotMetadata = {
      snapshotId,
      delegationId,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
    await writeFile(join(snapshotDir, 'metadata.json'), JSON.stringify(storedMetadata, null, 2));

    return snapshotDir;
  }

  private async load(delegationId: string, snapshotId: string): Promise<Buffer> {
    const zipPath = join(this.baseDir, delegationId, snapshotId, 'snapshot.zip');
    return readFile(zipPath);
  }

  private async deleteFromDisk(delegationId: string, snapshotId: string): Promise<void> {
    const snapshotDir = join(this.baseDir, delegationId, snapshotId);
    await rm(snapshotDir, { recursive: true, force: true });
  }
}

/**
 * Archive Transport Adapter
 *
 * Implements TransportAdapter interface for archive-based file transfer.
 * Uses base64-encoded ZIP archives transmitted inline in protocol messages.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type {
  TransportAdapter,
  TransportPrepareParams,
  TransportPrepareResult,
  TransportSetupParams,
  TransportTeardownParams,
  TransportTeardownResult,
  DependencyCheckResult,
  ArchiveWorkDirInfo,
} from '@awcp/core';
import { ArchiveCreator } from './delegator/archive-creator.js';
import { ArchiveExtractor } from './executor/archive-extractor.js';
import type { ArchiveTransportConfig } from './types.js';

export class ArchiveTransport implements TransportAdapter {
  readonly type = 'archive' as const;

  private creator?: ArchiveCreator;
  private extractor?: ArchiveExtractor;
  private tempDir: string;

  constructor(config: ArchiveTransportConfig = {}) {
    this.tempDir = config.delegator?.tempDir ?? config.executor?.tempDir ?? path.join(os.tmpdir(), 'awcp-archives');
  }

  // ========== Delegator Side ==========

  async prepare(params: TransportPrepareParams): Promise<TransportPrepareResult> {
    const { delegationId, exportPath } = params;

    if (!this.creator) {
      this.creator = new ArchiveCreator({ tempDir: this.tempDir });
    }

    const result = await this.creator.create(delegationId, exportPath);

    const workDirInfo: ArchiveWorkDirInfo = {
      transport: 'archive',
      workspaceBase64: result.base64,
      checksum: result.checksum,
    };

    return { workDirInfo };
  }

  async cleanup(delegationId: string): Promise<void> {
    await this.creator?.cleanup(delegationId);
  }

  // ========== Executor Side ==========

  async checkDependency(): Promise<DependencyCheckResult> {
    return { available: true };
  }

  async setup(params: TransportSetupParams): Promise<string> {
    const { delegationId, workDirInfo, workDir } = params;

    if (workDirInfo.transport !== 'archive') {
      throw new Error(`ArchiveTransport: unexpected transport type: ${workDirInfo.transport}`);
    }

    const info = workDirInfo as ArchiveWorkDirInfo;

    if (!this.extractor) {
      this.extractor = new ArchiveExtractor();
    }

    await fs.promises.mkdir(this.tempDir, { recursive: true });
    const archivePath = path.join(this.tempDir, `${delegationId}.zip`);

    // Decode base64 and write to file
    const buffer = Buffer.from(info.workspaceBase64, 'base64');
    await fs.promises.writeFile(archivePath, buffer);

    // Verify checksum
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hash !== info.checksum) {
      await fs.promises.unlink(archivePath);
      throw new Error(`Checksum mismatch: expected ${info.checksum}, got ${hash}`);
    }

    // Extract to work directory
    await this.extractor.extract(archivePath, workDir);

    // Clean up archive file
    await fs.promises.unlink(archivePath);

    return workDir;
  }

  async teardown(params: TransportTeardownParams): Promise<TransportTeardownResult> {
    const { delegationId, workDir } = params;

    if (!this.extractor) {
      this.extractor = new ArchiveExtractor();
    }

    await fs.promises.mkdir(this.tempDir, { recursive: true });
    const archivePath = path.join(this.tempDir, `${delegationId}-result.zip`);

    // Create archive from work directory
    await this.extractor.createArchive(workDir, archivePath);

    // Read as base64
    const buffer = await fs.promises.readFile(archivePath);
    const resultBase64 = buffer.toString('base64');

    // Clean up
    await fs.promises.unlink(archivePath);

    return { resultBase64 };
  }

  // ========== Lifecycle ==========

  async shutdown(): Promise<void> {
    await this.creator?.cleanupAll();
  }
}

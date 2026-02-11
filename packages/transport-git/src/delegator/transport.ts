import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  DelegatorTransportAdapter,
  TransportCapabilities,
  TransportPrepareParams,
  TransportHandle,
  GitTransportHandle,
  TransportApplySnapshotParams,
} from '@awcp/core';
import { applyResultToResources } from '@awcp/transport-archive';
import type { GitDelegatorTransportConfig, GitSnapshotInfo } from '../types.js';
import { execGit, configureAuth } from '../utils/index.js';

export class GitDelegatorTransport implements DelegatorTransportAdapter {
  readonly type = 'git' as const;
  readonly capabilities: TransportCapabilities = {
    supportsSnapshots: true,
    liveSync: false,
  };

  private config: GitDelegatorTransportConfig;
  private tempDir: string;
  private activeRepos = new Map<string, { workDir: string; taskBranch?: string }>();

  constructor(config: GitDelegatorTransportConfig) {
    this.config = config;
    this.tempDir = config.tempDir ?? path.join(os.tmpdir(), 'awcp-git');
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.tempDir, { recursive: true });
    await this.cleanOrphanedRepos();
  }

  async shutdown(): Promise<void> {
    await this.cleanOrphanedRepos();
  }

  async prepare(params: TransportPrepareParams): Promise<TransportHandle> {
    const { delegationId, exportPath } = params;
    const gitWorkDir = path.join(this.tempDir, delegationId);

    await fs.promises.mkdir(this.tempDir, { recursive: true });

    // Clean up existing repo if resuming
    await fs.promises.rm(gitWorkDir, { recursive: true, force: true });

    // Copy workspace files (dereference symlinks)
    await fs.promises.cp(exportPath, gitWorkDir, { recursive: true, dereference: true });
    await fs.promises.rm(path.join(gitWorkDir, '.awcp'), { recursive: true, force: true });

    // Initialize git and commit
    await execGit(gitWorkDir, ['init']);
    await execGit(gitWorkDir, ['add', '-A']);
    await execGit(gitWorkDir, ['commit', '-m', `AWCP: Initial workspace for ${delegationId}`, '--allow-empty']);

    const baseCommit = (await execGit(gitWorkDir, ['rev-parse', 'HEAD'])).trim();

    // Configure remote and push
    await configureAuth(gitWorkDir, this.config.auth);
    await execGit(gitWorkDir, ['remote', 'add', 'origin', this.config.remoteUrl]);
    await execGit(gitWorkDir, ['push', '-u', 'origin', 'main', '--force']);

    this.activeRepos.set(delegationId, { workDir: gitWorkDir });

    const handle: GitTransportHandle = {
      transport: 'git',
      repoUrl: this.config.remoteUrl,
      baseBranch: 'main',
      baseCommit,
      auth: this.config.auth,
    };
    return handle;
  }

  async applySnapshot(params: TransportApplySnapshotParams): Promise<void> {
    const { delegationId, snapshotData, resources } = params;
    const snapshotInfo = JSON.parse(snapshotData) as GitSnapshotInfo;
    const repo = this.activeRepos.get(delegationId);

    if (!repo) {
      throw new Error(`GitDelegatorTransport: no active repo for delegation ${delegationId}`);
    }

    await execGit(repo.workDir, ['fetch', 'origin', snapshotInfo.branch]);
    await execGit(repo.workDir, ['merge', `origin/${snapshotInfo.branch}`, '--no-edit']);
    await applyResultToResources(repo.workDir, resources);

    // Remember task branch for remote cleanup in release()
    repo.taskBranch = snapshotInfo.branch;
  }

  async detach(_delegationId: string): Promise<void> {}

  async release(delegationId: string): Promise<void> {
    const repo = this.activeRepos.get(delegationId);
    if (!repo) return;

    if (this.config.deleteRemoteBranch !== false && repo.taskBranch) {
      await execGit(repo.workDir, ['push', 'origin', '--delete', repo.taskBranch]).catch(() => {});
    }

    await fs.promises.rm(repo.workDir, { recursive: true, force: true });
    this.activeRepos.delete(delegationId);
  }

  private async cleanOrphanedRepos(): Promise<void> {
    const activeWorkDirs = new Set([...this.activeRepos.values()].map((r) => path.basename(r.workDir)));
    const entries = await fs.promises.readdir(this.tempDir).catch(() => []);
    for (const entry of entries) {
      if (!activeWorkDirs.has(entry)) {
        await fs.promises.rm(path.join(this.tempDir, entry), { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

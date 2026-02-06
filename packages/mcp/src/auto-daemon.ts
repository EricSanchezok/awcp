/**
 * Auto-start Delegator Daemon
 *
 * Automatically starts the Delegator Daemon if not running.
 * Used by MCP server to provide zero-config experience.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { DelegatorConfig } from '@awcp/sdk';
import type { AccessMode, SnapshotPolicy, GitCredential } from '@awcp/core';
import { startDelegatorDaemon, type DaemonInstance } from '@awcp/sdk/delegator/daemon';
import { ArchiveTransport } from '@awcp/transport-archive';

export interface AutoDaemonOptions {
  // === Daemon ===
  port?: number;
  startTimeout?: number;

  // === Environment ===
  environmentDir?: string;

  // === Transport ===
  transport?: 'archive' | 'sshfs' | 'storage' | 'git';

  // === Admission Control ===
  maxTotalBytes?: number;
  maxFileCount?: number;
  maxSingleFileBytes?: number;

  // === Snapshot ===
  snapshotMode?: SnapshotPolicy;

  // === Defaults ===
  defaultTtl?: number;
  defaultAccessMode?: AccessMode;

  // === Archive Transport Options ===
  tempDir?: string;

  // === SSHFS Transport Options ===
  sshCaKey?: string;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshKeyDir?: string;

  // === Storage Transport Options ===
  storageEndpoint?: string;
  storageLocalDir?: string;

  // === Git Transport Options ===
  gitRemoteUrl?: string;
  gitAuthType?: 'token' | 'ssh' | 'none';
  gitToken?: string;
  gitSshKeyPath?: string;
  gitBranchPrefix?: string;
  gitCleanupRemoteBranch?: boolean;
}

function getAwcpDir(): string {
  return process.env.AWCP_HOME || join(homedir(), '.awcp');
}

async function isDaemonRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForDaemon(url: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isDaemonRunning(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function buildGitAuth(options: AutoDaemonOptions): GitCredential {
  const authType = options.gitAuthType ?? 'none';

  if (authType === 'token' && options.gitToken) {
    return { type: 'token', token: options.gitToken };
  }

  if (authType === 'ssh') {
    // TODO: Load SSH private key from gitSshKeyPath if provided
    return { type: 'ssh' };
  }

  return { type: 'none' };
}

async function createDefaultConfig(options: AutoDaemonOptions): Promise<DelegatorConfig> {
  const awcpDir = getAwcpDir();
  const environmentDir = options.environmentDir || join(awcpDir, 'environments');
  const tempDir = options.tempDir || join(awcpDir, 'temp');

  let transport;
  if (options.transport === 'sshfs') {
    const { SshfsTransport } = await import('@awcp/transport-sshfs');

    if (!options.sshCaKey) {
      throw new Error('SSHFS transport requires --ssh-ca-key option');
    }

    transport = new SshfsTransport({
      delegator: {
        caKeyPath: options.sshCaKey,
        keyDir: options.sshKeyDir || join(awcpDir, 'keys'),
        host: options.sshHost || 'localhost',
        port: options.sshPort || 22,
        user: options.sshUser || process.env.USER,
      },
    });
  } else if (options.transport === 'storage') {
    const { StorageTransport } = await import('@awcp/transport-storage');

    if (!options.storageEndpoint) {
      throw new Error('Storage transport requires --storage-endpoint option');
    }

    transport = new StorageTransport({
      delegator: {
        provider: {
          type: 'local',
          localDir: options.storageLocalDir || join(awcpDir, 'storage'),
          endpoint: options.storageEndpoint,
        },
        tempDir,
      },
    });
  } else if (options.transport === 'git') {
    const { GitTransport } = await import('@awcp/transport-git');

    if (!options.gitRemoteUrl) {
      throw new Error('Git transport requires --git-remote-url option');
    }

    transport = new GitTransport({
      delegator: {
        remoteUrl: options.gitRemoteUrl,
        auth: buildGitAuth(options),
        tempDir,
        branchPrefix: options.gitBranchPrefix,
        cleanupRemoteBranch: options.gitCleanupRemoteBranch,
      },
    });
  } else {
    transport = new ArchiveTransport({
      delegator: {
        tempDir,
      },
    });
  }

  return {
    baseDir: environmentDir,
    transport,
    admission: {
      maxTotalBytes: options.maxTotalBytes,
      maxFileCount: options.maxFileCount,
      maxSingleFileBytes: options.maxSingleFileBytes,
    },
    snapshot: {
      mode: options.snapshotMode,
    },
    defaults: {
      ttlSeconds: options.defaultTtl,
      accessMode: options.defaultAccessMode,
    },
  };
}

async function ensureDirectories(options: AutoDaemonOptions): Promise<void> {
  const awcpDir = getAwcpDir();
  const environmentDir = options.environmentDir || join(awcpDir, 'environments');
  const tempDir = options.tempDir || join(awcpDir, 'temp');

  await mkdir(awcpDir, { recursive: true });
  await mkdir(environmentDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });
}

export async function startInProcessDaemon(
  options: AutoDaemonOptions = {}
): Promise<DaemonInstance> {
  const port = options.port ?? 3100;

  await ensureDirectories(options);

  const config = await createDefaultConfig(options);

  const daemon = await startDelegatorDaemon({
    port,
    delegator: config,
  });

  return daemon;
}

export async function ensureDaemonRunning(
  options: AutoDaemonOptions = {}
): Promise<{ url: string; daemon?: DaemonInstance }> {
  const port = options.port ?? 3100;
  const url = `http://localhost:${port}`;
  const startTimeout = options.startTimeout ?? 10000;

  if (await isDaemonRunning(url)) {
    console.error(`[AWCP] Daemon already running at ${url}`);
    return { url };
  }

  console.error(`[AWCP] Starting Delegator Daemon on port ${port}...`);

  try {
    const daemon = await startInProcessDaemon(options);

    if (await waitForDaemon(url, startTimeout)) {
      console.error(`[AWCP] Daemon started successfully at ${url}`);
      return { url, daemon };
    } else {
      throw new Error('Daemon started but health check failed');
    }
  } catch (error) {
    throw new Error(
      `Failed to start Delegator Daemon: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

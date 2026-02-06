/**
 * AWCP Daemon Management
 * 
 * Shared utilities for managing the Delegator daemon lifecycle.
 * Auto-starts daemon if not running, reuses existing daemon if available.
 * 
 * This module uses @awcp/sdk to start the daemon programmatically.
 * Requires: npm install @awcp/sdk @awcp/transport-archive express
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_PORT = 3100;
const DEFAULT_TIMEOUT = 15000;

// Singleton to track in-process daemon
let activeDaemon: { url: string; stop: () => Promise<void> } | null = null;

export interface DaemonConfig {
  port?: number;
  timeout?: number;
}

export interface DaemonConnection {
  url: string;
}

function getAwcpDir(): string {
  return process.env.AWCP_HOME || join(homedir(), '.awcp');
}

function getDaemonPort(): number {
  return parseInt(process.env.AWCP_DAEMON_PORT || '', 10) || DEFAULT_PORT;
}

async function isDaemonRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureDirectories(): Promise<{ awcpDir: string; envDir: string; tempDir: string }> {
  const awcpDir = getAwcpDir();
  const envDir = join(awcpDir, 'environments');
  const tempDir = join(awcpDir, 'temp');

  await mkdir(awcpDir, { recursive: true });
  await mkdir(envDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  return { awcpDir, envDir, tempDir };
}

/**
 * Start daemon in-process using @awcp/sdk
 */
async function startDaemonInProcess(port: number): Promise<{ url: string; stop: () => Promise<void> }> {
  const { envDir, tempDir } = await ensureDirectories();
  
  // Dynamic imports to avoid hard dependency
  const { startDelegatorDaemon } = await import('@awcp/sdk/delegator/daemon');
  const { ArchiveTransport } = await import('@awcp/transport-archive');

  const transport = new ArchiveTransport({
    delegator: { tempDir },
  });

  const daemon = await startDelegatorDaemon({
    port,
    delegator: {
      baseDir: envDir,
      transport,
    },
  });

  return daemon;
}

/**
 * Ensure daemon is running, starting it if necessary.
 * Returns the daemon URL for API calls.
 */
export async function ensureDaemon(config: DaemonConfig = {}): Promise<DaemonConnection> {
  const port = config.port ?? getDaemonPort();
  const url = `http://localhost:${port}`;

  // Check if already running (external or from previous call)
  if (await isDaemonRunning(url)) {
    return { url };
  }

  // Return existing in-process daemon if we have one
  if (activeDaemon && await isDaemonRunning(activeDaemon.url)) {
    return { url: activeDaemon.url };
  }

  // Start daemon in-process
  console.error(`[AWCP] Starting daemon on port ${port}...`);
  
  try {
    const daemon = await startDaemonInProcess(port);
    activeDaemon = daemon;
    console.error(`[AWCP] Daemon ready at ${url}`);
    return { url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start daemon: ${msg}. Ensure @awcp/sdk and @awcp/transport-archive are installed.`);
  }
}

/**
 * HTTP client for Delegator Daemon API
 */
export class DaemonClient {
  constructor(private baseUrl: string, private timeout = 30000) {}

  async request<T>(path: string, options?: {
    method?: string;
    body?: unknown;
  }): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options?.method ?? 'GET',
        headers: options?.body ? { 'Content-Type': 'application/json' } : {},
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as {
          error?: string;
          hint?: string;
          code?: string;
        };
        const error = {
          error: errorBody.error ?? `HTTP ${response.status}: ${response.statusText}`,
          code: errorBody.code,
          hint: errorBody.hint,
        };
        throw error;
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async delegate(params: {
    executorUrl: string;
    environment: {
      resources: Array<{
        name: string;
        type: 'fs';
        source: string;
        mode: 'ro' | 'rw';
      }>;
    };
    task: {
      description: string;
      prompt: string;
    };
    ttlSeconds?: number;
    accessMode?: 'ro' | 'rw';
    snapshotMode?: 'auto' | 'staged' | 'discard';
  }): Promise<{ delegationId: string }> {
    return this.request('/delegate', { method: 'POST', body: params });
  }

  async getDelegation(id: string): Promise<{
    id: string;
    state: string;
    result?: { summary?: string; filesChanged?: number };
    error?: { code: string; message: string; hint?: string };
    snapshots?: Array<{ id: string; status: string; summary?: string }>;
  }> {
    return this.request(`/delegation/${id}`);
  }

  async listSnapshots(id: string): Promise<{
    snapshots: Array<{ id: string; status: string; summary?: string; createdAt?: string }>;
  }> {
    return this.request(`/delegation/${id}/snapshots`);
  }

  async applySnapshot(delegationId: string, snapshotId: string): Promise<void> {
    await this.request(`/delegation/${delegationId}/snapshots/${snapshotId}/apply`, {
      method: 'POST',
    });
  }

  async discardSnapshot(delegationId: string, snapshotId: string): Promise<void> {
    await this.request(`/delegation/${delegationId}/snapshots/${snapshotId}/discard`, {
      method: 'POST',
    });
  }

  async waitForCompletion(
    id: string,
    pollIntervalMs = 1000,
    timeoutMs = 300000
  ): Promise<{
    id: string;
    state: string;
    result?: { summary?: string; filesChanged?: number };
    error?: { code: string; message: string; hint?: string };
    snapshots?: Array<{ id: string; status: string; summary?: string }>;
  }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const delegation = await this.getDelegation(id);

      if (['completed', 'error', 'cancelled', 'expired'].includes(delegation.state)) {
        return delegation;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw { error: 'Timeout waiting for delegation to complete', code: 'TIMEOUT' };
  }
}

/**
 * Parse CLI arguments into a key-value object
 */
export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  
  return result;
}

/**
 * Output JSON result and exit
 */
export function output(data: unknown, exitCode = 0): never {
  console.log(JSON.stringify(data, null, 2));
  process.exit(exitCode);
}

/**
 * Output error and exit
 */
export function error(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'error' in err) {
    output(err, 1);
  }
  output({ error: err instanceof Error ? err.message : String(err) }, 1);
}

/**
 * Get connected daemon client
 */
export async function getClient(): Promise<DaemonClient> {
  const { url } = await ensureDaemon();
  return new DaemonClient(url);
}

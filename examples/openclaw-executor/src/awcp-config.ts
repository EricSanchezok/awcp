/**
 * AWCP Executor Configuration
 */

import path from 'node:path';
import type { ExecutorConfig, TaskStartContext, ListenerAdapter } from '@awcp/sdk';
import { resolveWorkDir, HttpListener, WebSocketTunnelListener } from '@awcp/sdk';
import type { InviteMessage, ExecutorTransportAdapter } from '@awcp/core';
import { ArchiveExecutorTransport } from '@awcp/transport-archive';
import { SshfsExecutorTransport } from '@awcp/transport-sshfs';
import { StorageExecutorTransport } from '@awcp/transport-storage';
import { GitExecutorTransport } from '@awcp/transport-git';
import type { AppConfig } from './app-config.js';
import type { OpenClawExecutor } from './openclaw-executor.js';
import type { OpenClawGatewayManager } from './gateway-manager.js';

function createTransport(tempDir: string): ExecutorTransportAdapter {
  const type = process.env.AWCP_TRANSPORT || 'archive';
  if (type === 'sshfs') {
    console.log('[AWCP] Using SSHFS transport');
    return new SshfsExecutorTransport();
  }
  if (type === 'storage') {
    console.log('[AWCP] Using Storage transport');
    return new StorageExecutorTransport({ tempDir });
  }
  if (type === 'git') {
    console.log('[AWCP] Using Git transport');
    return new GitExecutorTransport({ tempDir });
  }
  console.log('[AWCP] Using Archive transport');
  return new ArchiveExecutorTransport({ tempDir });
}

function createListeners(): ListenerAdapter[] {
  const listeners: ListenerAdapter[] = [new HttpListener()];

  if (process.env.AWCP_TUNNEL_SERVER) {
    console.log('[AWCP] Tunnel enabled');
    listeners.push(
      new WebSocketTunnelListener({
        server: process.env.AWCP_TUNNEL_SERVER,
        token: process.env.AWCP_TUNNEL_TOKEN!,
        reconnect: { enabled: true, maxRetries: 10, delayMs: 5000 },
      }),
    );
  }

  return listeners;
}

export function createAwcpConfig(
  appConfig: AppConfig,
  executor: OpenClawExecutor,
  gatewayManager: OpenClawGatewayManager,
): ExecutorConfig {
  const workDir = path.join(appConfig.dataDir, 'workdir');
  const tempDir = path.join(appConfig.dataDir, 'temp');

  return {
    workDir,
    transport: createTransport(tempDir),
    listeners: createListeners(),

    admission: {
      maxConcurrentDelegations: 3,
      maxTtlSeconds: 7200,
    },
    assignment: {
      sandbox: {
        cwdOnly: true,
        allowNetwork: true,
        allowExec: true,
      },
    },

    hooks: {
      onAdmissionCheck: async (invite: InviteMessage) => {
        console.log(`[AWCP] INVITE: ${invite.delegationId} - ${invite.task.description}`);
      },

      onTaskStart: (ctx: TaskStartContext) => {
        const resolvedWorkDir = resolveWorkDir(ctx);
        console.log(`[AWCP] Task started: ${ctx.delegationId}`);
        console.log(`[AWCP] Working directory: ${resolvedWorkDir}`);

        executor.setWorkingDirectory(resolvedWorkDir, {
          delegationId: ctx.delegationId,
          taskId: ctx.delegationId,
          leaseExpiresAt: new Date(ctx.lease.expiresAt),
        });

        gatewayManager.updateWorkspace(resolvedWorkDir);
      },

      onTaskComplete: (delegationId: string, _summary: string) => {
        console.log(`[AWCP] Completed: ${delegationId}`);
        executor.clearWorkingDirectory();
      },

      onError: (delegationId: string, error: Error) => {
        console.error(`[AWCP] Error: ${delegationId}`, error.message);
        executor.clearWorkingDirectory();
      },

      onListenerConnected: (info) => {
        console.log(`[AWCP] Listener ready: ${info.type} -> ${info.publicUrl}`);
      },

      onListenerDisconnected: (type, error) => {
        console.warn(`[AWCP] Listener disconnected: ${type}`, error?.message);
      },
    },
  };
}

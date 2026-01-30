/**
 * SSHFS Transport Adapter
 * 
 * Implements TransportAdapter interface for SSHFS transport.
 */

import type {
  TransportAdapter,
  TransportPrepareParams,
  TransportPrepareResult,
  TransportSetupParams,
  TransportTeardownParams,
  DependencyCheckResult,
  SshfsMountInfo,
} from '@awcp/core';
import { CredentialManager } from './delegator/credential-manager.js';
import { SshfsMountClient } from './executor/sshfs-client.js';

export interface SshfsTransportConfig {
  // Delegator-side
  keyDir?: string;
  host?: string;
  port?: number;
  user?: string;
  caKeyPath?: string;

  // Executor-side
  tempKeyDir?: string;
  defaultMountOptions?: Record<string, string>;
  mountTimeout?: number;
}

export class SshfsTransport implements TransportAdapter {
  readonly type = 'sshfs' as const;

  private config: SshfsTransportConfig;
  private credentialManager?: CredentialManager;
  private mountClient?: SshfsMountClient;

  constructor(config: SshfsTransportConfig = {}) {
    this.config = config;
  }

  // ========== Delegator Side ==========

  async prepare(params: TransportPrepareParams): Promise<TransportPrepareResult> {
    if (!this.credentialManager) {
      if (!this.config.caKeyPath) {
        throw new Error('SshfsTransport: caKeyPath is required for Delegator operations');
      }
      this.credentialManager = new CredentialManager({
        keyDir: this.config.keyDir,
        sshHost: this.config.host,
        sshPort: this.config.port,
        sshUser: this.config.user,
        caKeyPath: this.config.caKeyPath,
      });
    }

    const { delegationId, exportPath, ttlSeconds } = params;
    const { credential, endpoint } = await this.credentialManager.generateCredential(
      delegationId,
      ttlSeconds,
    );

    const mountInfo: SshfsMountInfo = {
      transport: 'sshfs',
      endpoint,
      exportLocator: exportPath,
      credential,
    };

    return { mountInfo };
  }

  async cleanup(delegationId: string): Promise<void> {
    await this.credentialManager?.revokeCredential(delegationId);
  }

  // ========== Executor Side ==========

  async checkDependency(): Promise<DependencyCheckResult> {
    this.ensureMountClient();
    const result = await this.mountClient!.checkDependency();

    return {
      available: result.available,
      hint: result.available
        ? undefined
        : 'Install sshfs: brew install macfuse && brew install sshfs (macOS) or apt install sshfs (Linux)',
    };
  }

  async setup(params: TransportSetupParams): Promise<string> {
    this.ensureMountClient();
    const { mountInfo, targetDir } = params;

    if (mountInfo.transport !== 'sshfs') {
      throw new Error(`SshfsTransport: unexpected transport type: ${mountInfo.transport}`);
    }

    const info = mountInfo as SshfsMountInfo;
    await this.mountClient!.mount({
      endpoint: info.endpoint,
      exportLocator: info.exportLocator,
      credential: info.credential,
      mountPoint: targetDir,
      options: info.mountOptions,
    });

    return targetDir;
  }

  async teardown(params: TransportTeardownParams): Promise<void> {
    await this.mountClient?.unmount(params.workDir);
  }

  // ========== Helpers ==========

  private ensureMountClient(): void {
    if (!this.mountClient) {
      this.mountClient = new SshfsMountClient({
        tempKeyDir: this.config.tempKeyDir,
        defaultOptions: this.config.defaultMountOptions,
        mountTimeout: this.config.mountTimeout,
      });
    }
  }

  async unmountAll(): Promise<void> {
    await this.mountClient?.unmountAll();
  }

  async revokeAllCredentials(): Promise<void> {
    await this.credentialManager?.revokeAll();
  }

  async cleanupStaleKeyFiles(): Promise<number> {
    return this.credentialManager?.cleanupStaleKeyFiles() ?? 0;
  }
}

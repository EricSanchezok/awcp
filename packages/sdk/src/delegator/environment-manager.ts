/**
 * Environment Manager - manages environment directories for delegation
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EnvironmentSpec } from '@awcp/core';
import { ResourceAdapterRegistry, FsResourceAdapter } from './resource-adapters/index.js';
import { cleanupStaleDirectories } from '../utils/index.js';

const DEFAULT_ENV_BASE = '/tmp/awcp/environments';

export interface EnvironmentManifest {
  version: '1';
  delegationId: string;
  createdAt: string;
  resources: Array<{
    name: string;
    type: string;
    source: string;
    mode: 'ro' | 'rw';
  }>;
}

export interface EnvironmentBuildResult {
  envRoot: string;
  manifest: EnvironmentManifest;
}

export interface EnvironmentManagerConfig {
  baseDir?: string;
}

export class EnvironmentManager {
  private baseDir: string;
  private adapters: ResourceAdapterRegistry;

  constructor(config?: EnvironmentManagerConfig) {
    this.baseDir = config?.baseDir ?? DEFAULT_ENV_BASE;
    this.adapters = new ResourceAdapterRegistry();
    this.adapters.register(new FsResourceAdapter());
  }

  async build(delegationId: string, spec: EnvironmentSpec): Promise<EnvironmentBuildResult> {
    const envRoot = join(this.baseDir, delegationId);
    await mkdir(envRoot, { recursive: true });

    for (const resource of spec.resources) {
      const targetPath = join(envRoot, resource.name);
      const adapter = this.adapters.get(resource.type);
      await adapter.materialize(resource, targetPath);
    }

    const manifest: EnvironmentManifest = {
      version: '1',
      delegationId,
      createdAt: new Date().toISOString(),
      resources: spec.resources.map(r => ({
        name: r.name,
        type: r.type,
        source: r.source,
        mode: r.mode,
      })),
    };

    const awcpDir = join(envRoot, '.awcp');
    await mkdir(awcpDir, { recursive: true });
    await writeFile(join(awcpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    return { envRoot: `${envRoot}/`, manifest };
  }

  async release(delegationId: string): Promise<void> {
    const envRoot = join(this.baseDir, delegationId);
    await rm(envRoot, { recursive: true, force: true }).catch(() => {});
  }

  async cleanupStale(knownIds: Set<string>): Promise<number> {
    return cleanupStaleDirectories(this.baseDir, knownIds);
  }
}

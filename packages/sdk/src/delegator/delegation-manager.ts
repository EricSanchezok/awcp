import { mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Delegation } from '@awcp/core';

export interface DelegationManagerConfig {
  baseDir: string;
}

export class DelegationManager {
  private baseDir: string;

  constructor(config: DelegationManagerConfig) {
    this.baseDir = config.baseDir;
  }

  async save(delegation: Delegation): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const filePath = join(this.baseDir, `${delegation.id}.json`);
    await writeFile(filePath, JSON.stringify(delegation, null, 2));
  }

  async load(delegationId: string): Promise<Delegation | undefined> {
    try {
      const filePath = join(this.baseDir, `${delegationId}.json`);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as Delegation;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async loadAll(): Promise<Delegation[]> {
    try {
      const entries = await readdir(this.baseDir);
      const delegations: Delegation[] = [];
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const content = await readFile(join(this.baseDir, entry), 'utf-8');
        delegations.push(JSON.parse(content) as Delegation);
      }
      return delegations;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async delete(delegationId: string): Promise<void> {
    const filePath = join(this.baseDir, `${delegationId}.json`);
    await rm(filePath, { force: true });
  }
}

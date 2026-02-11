import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitDelegatorTransport } from '../src/delegator/transport.js';
import { GitExecutorTransport } from '../src/executor/transport.js';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('GitDelegatorTransport', () => {
  describe('constructor', () => {
    it('should create instance with required config', () => {
      const transport = new GitDelegatorTransport({
        remoteUrl: 'https://github.com/test/repo.git',
        auth: { type: 'none' },
      });
      expect(transport.type).toBe('git');
      expect(transport.capabilities).toEqual({
        supportsSnapshots: true,
        liveSync: false,
      });
    });
  });

  describe('prepare', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'awcp-git-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw error when export path does not exist', async () => {
      const transport = new GitDelegatorTransport({
        remoteUrl: 'https://github.com/test/repo.git',
        auth: { type: 'none' },
        tempDir,
      });
      await expect(
        transport.prepare({
          delegationId: 'test-dlg',
          exportPath: '/nonexistent/path',
          ttlSeconds: 3600,
        }),
      ).rejects.toThrow();
    });
  });

  describe('detach', () => {
    it('should be a no-op', async () => {
      const transport = new GitDelegatorTransport({
        remoteUrl: 'https://github.com/test/repo.git',
        auth: { type: 'none' },
      });
      await expect(transport.detach('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('release', () => {
    it('should handle nonexistent delegation gracefully', async () => {
      const transport = new GitDelegatorTransport({
        remoteUrl: 'https://github.com/test/repo.git',
        auth: { type: 'none' },
      });
      await expect(transport.release('nonexistent')).resolves.toBeUndefined();
    });
  });
});

describe('GitExecutorTransport', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      const transport = new GitExecutorTransport();
      expect(transport.type).toBe('git');
      expect(transport.capabilities).toEqual({
        supportsSnapshots: true,
        liveSync: false,
      });
    });

    it('should accept custom config', () => {
      const transport = new GitExecutorTransport({
        tempDir: '/custom/temp',
        branchPrefix: 'task/',
      });
      expect(transport.type).toBe('git');
    });
  });

  describe('checkDependency', () => {
    it('should return available true when git is installed', async () => {
      const transport = new GitExecutorTransport();
      const result = await transport.checkDependency();
      expect(result.available).toBe(true);
    });
  });

  describe('setup', () => {
    it('should reject non-git handle', async () => {
      const transport = new GitExecutorTransport();
      await expect(
        transport.setup({
          delegationId: 'test',
          handle: { transport: 'archive', archiveBase64: '', checksum: '' } as any,
          localPath: '/tmp/test',
        }),
      ).rejects.toThrow('unexpected transport type: archive');
    });
  });

  describe('captureSnapshot', () => {
    it('should throw when no active setup exists', async () => {
      const transport = new GitExecutorTransport();
      await expect(
        transport.captureSnapshot({
          delegationId: 'nonexistent',
          localPath: '/tmp/test',
        }),
      ).rejects.toThrow('no active setup for delegation nonexistent');
    });
  });

  describe('detach', () => {
    it('should handle missing delegation gracefully', async () => {
      const transport = new GitExecutorTransport();
      await expect(
        transport.detach({ delegationId: 'nonexistent', localPath: '/tmp/nonexistent' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('release', () => {
    it('should handle missing delegation gracefully', async () => {
      const transport = new GitExecutorTransport();
      await expect(
        transport.release({ delegationId: 'nonexistent', localPath: '/tmp/nonexistent' }),
      ).resolves.toBeUndefined();
    });
  });
});

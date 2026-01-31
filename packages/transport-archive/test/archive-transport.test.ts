import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ArchiveTransport } from '../src/archive-transport.js';

describe('ArchiveTransport', () => {
  let tempDir: string;
  let transport: ArchiveTransport;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'awcp-test-'));
    transport = new ArchiveTransport({
      delegator: { tempDir },
      executor: { tempDir },
    });
  });

  afterEach(async () => {
    await transport.shutdown();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('should report dependencies as available', async () => {
    const result = await transport.checkDependency();
    expect(result.available).toBe(true);
  });

  it('should prepare and setup a workspace', async () => {
    // Create export directory
    const exportDir = path.join(tempDir, 'export');
    await fs.promises.mkdir(exportDir, { recursive: true });
    await fs.promises.writeFile(path.join(exportDir, 'test.txt'), 'hello world');
    await fs.promises.mkdir(path.join(exportDir, 'subdir'));
    await fs.promises.writeFile(path.join(exportDir, 'subdir', 'nested.txt'), 'nested');

    // Delegator: prepare
    const prepareResult = await transport.prepare({
      delegationId: 'test-delegation',
      exportPath: exportDir,
      ttlSeconds: 300,
    });

    expect(prepareResult.workDirInfo.transport).toBe('archive');
    expect(prepareResult.workDirInfo.workspaceBase64).toBeDefined();
    expect(prepareResult.workDirInfo.checksum).toMatch(/^[a-f0-9]{64}$/);

    // Executor: setup (download and extract)
    const workDir = path.join(tempDir, 'work');
    const resultPath = await transport.setup({
      delegationId: 'test-delegation',
      workDirInfo: prepareResult.workDirInfo,
      workDir,
    });

    expect(resultPath).toBe(workDir);

    // Verify files were extracted
    const testContent = await fs.promises.readFile(path.join(workDir, 'test.txt'), 'utf-8');
    expect(testContent).toBe('hello world');

    const nestedContent = await fs.promises.readFile(
      path.join(workDir, 'subdir', 'nested.txt'),
      'utf-8',
    );
    expect(nestedContent).toBe('nested');
  });

  it('should complete full delegation flow with changes', async () => {
    // Create export directory
    const exportDir = path.join(tempDir, 'export');
    await fs.promises.mkdir(exportDir, { recursive: true });
    await fs.promises.writeFile(path.join(exportDir, 'original.txt'), 'original content');

    // Delegator: prepare
    const prepareResult = await transport.prepare({
      delegationId: 'test-delegation',
      exportPath: exportDir,
      ttlSeconds: 300,
    });

    // Executor: setup
    const workDir = path.join(tempDir, 'work');
    await transport.setup({
      delegationId: 'test-delegation',
      workDirInfo: prepareResult.workDirInfo,
      workDir,
    });

    // Executor: make changes
    await fs.promises.writeFile(path.join(workDir, 'original.txt'), 'modified content');
    await fs.promises.writeFile(path.join(workDir, 'new-file.txt'), 'new file content');

    // Executor: teardown (returns result as base64)
    const teardownResult = await transport.teardown({
      delegationId: 'test-delegation',
      workDir,
    });

    // Verify teardown returns base64 result
    expect(teardownResult.resultBase64).toBeDefined();
    expect(teardownResult.resultBase64!.length).toBeGreaterThan(0);

    // Verify the result can be decoded and contains the changes
    const resultBuffer = Buffer.from(teardownResult.resultBase64!, 'base64');
    const resultPath = path.join(tempDir, 'result.zip');
    await fs.promises.writeFile(resultPath, resultBuffer);

    // Extract and verify
    const { ArchiveExtractor } = await import('../src/executor/archive-extractor.js');
    const extractor = new ArchiveExtractor();
    const resultDir = path.join(tempDir, 'result');
    await extractor.extract(resultPath, resultDir);

    const modifiedContent = await fs.promises.readFile(
      path.join(resultDir, 'original.txt'),
      'utf-8',
    );
    expect(modifiedContent).toBe('modified content');

    const newContent = await fs.promises.readFile(path.join(resultDir, 'new-file.txt'), 'utf-8');
    expect(newContent).toBe('new file content');
  });
});

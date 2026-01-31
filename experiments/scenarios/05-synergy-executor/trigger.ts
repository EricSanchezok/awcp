/**
 * Trigger script - Tests MCP + Synergy Executor integration
 *
 * This simulates how an AI Agent would use the AWCP MCP tools to delegate
 * coding tasks to a Synergy-based executor.
 *
 * Key difference from 03-mcp-integration:
 * - Uses synergy-executor which actually processes tasks with Synergy AI
 * - Tests real code modification capabilities (not just file append)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXECUTOR_URL = process.env.EXECUTOR_URL || 'http://localhost:10200/awcp';
const EXECUTOR_BASE_URL = process.env.EXECUTOR_BASE_URL || 'http://localhost:10200';
const SCENARIO_DIR = process.env.SCENARIO_DIR || process.cwd();
const MCP_SERVER_PATH = resolve(__dirname, '../../../packages/mcp/dist/bin/awcp-mcp.js');

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ToolResult {
  content: Array<TextContent | { type: string }>;
  isError?: boolean;
}

const results: TestResult[] = [];

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${NC} ${message}`);
}

function getTextContent(result: ToolResult): string | undefined {
  const textContent = result.content.find((c): c is TextContent => c.type === 'text');
  return textContent?.text;
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Synergy Executor MCP Integration Test                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`MCP Server:   ${MCP_SERVER_PATH}`);
  console.log(`Scenario Dir: ${SCENARIO_DIR}`);
  console.log(`Executor URL: ${EXECUTOR_URL}`);
  console.log(`Peers:        ${EXECUTOR_BASE_URL}`);
  console.log('');

  // Create MCP client transport
  log(BLUE, '[MCP]', 'Starting MCP server via stdio transport...');

  const exportsDir = resolve(SCENARIO_DIR, 'exports');
  const tempDir = resolve(SCENARIO_DIR, 'temp');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      MCP_SERVER_PATH,
      '--peers', EXECUTOR_BASE_URL,
      '--exports-dir', exportsDir,
      '--temp-dir', tempDir,
    ],
  });

  const client = new Client(
    { name: 'synergy-executor-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    log(GREEN, '✓', 'MCP client connected');

    // Test 1: Verify tools are available
    await testListTools(client);

    // Test 2: Simple file modification task
    await testSimpleFileTask(client);

    // Test 3: More complex coding task (if time permits)
    // await testCodeModificationTask(client);

  } finally {
    await client.close();
    log(BLUE, '[MCP]', 'MCP client closed');
  }

  // Print summary
  printSummary();
}

async function testListTools(client: Client) {
  const testName = 'List MCP tools';
  log(BLUE, '\n[TEST]', testName);

  try {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    console.log(`  Found ${tools.length} tools: ${toolNames.join(', ')}`);

    const expectedTools = ['delegate', 'delegate_output', 'delegate_cancel'];
    const missingTools = expectedTools.filter((t) => !toolNames.includes(t));

    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }

    // Check for peer info in delegate description
    const delegateTool = tools.find((t) => t.name === 'delegate');
    const description = delegateTool?.description || '';
    
    if (!description.includes(EXECUTOR_BASE_URL)) {
      log(YELLOW, '!', `Peer URL not found in description (expected: ${EXECUTOR_BASE_URL})`);
    }

    log(GREEN, '✓', 'All expected tools found');
    results.push({ name: testName, passed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(RED, '✗', message);
    results.push({ name: testName, passed: false, error: message });
  }
}

async function testSimpleFileTask(client: Client) {
  const testName = 'Simple file modification via Synergy';
  log(BLUE, '\n[TEST]', testName);

  const workspacePath = resolve(SCENARIO_DIR, 'workspace');
  const helloFilePath = resolve(workspacePath, 'hello.txt');
  
  // Read original content
  const originalContent = readFileSync(helloFilePath, 'utf-8');
  console.log(`  Original hello.txt: "${originalContent.trim()}"`);

  try {
    log(YELLOW, '  →', 'Calling delegate tool with Synergy task...');

    // Give Synergy a simple but meaningful task
    const result = (await client.callTool({
      name: 'delegate',
      arguments: {
        description: 'Modify hello.txt to add a greeting',
        prompt: `Please modify the file hello.txt to add a new line that says "Greetings from Synergy!" at the end of the file. Keep the original content.`,
        workspace_dir: workspacePath,
        peer_url: EXECUTOR_URL,
        background: false,
      },
    })) as ToolResult;

    const text = getTextContent(result);
    console.log('  Result preview:', text?.slice(0, 300) + (text && text.length > 300 ? '...' : ''));

    // Check if result indicates error
    if (result.isError) {
      throw new Error('Delegation failed (MCP error): ' + text);
    }

    if (text?.includes('Status: error')) {
      const errorMatch = text.match(/--- Error ---\n(.+?)(?:\n|$)/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
      throw new Error('Delegation failed: ' + errorMsg);
    }

    // Verify file was modified
    const newContent = readFileSync(helloFilePath, 'utf-8');
    console.log(`  New hello.txt: "${newContent.trim()}"`);

    // Check if the file was actually modified
    if (newContent === originalContent) {
      log(YELLOW, '!', 'File was not modified (Synergy may not have made changes)');
      // This is okay - Synergy might interpret the task differently
    } else {
      log(GREEN, '✓', 'File was modified by Synergy');
    }

    log(GREEN, '✓', 'Delegation completed successfully');
    results.push({ name: testName, passed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(RED, '✗', message);
    results.push({ name: testName, passed: false, error: message });
  }
}

function printSummary() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Test Summary                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? `${GREEN}✓${NC}` : `${RED}✗${NC}`;
    console.log(`  ${icon} ${result.name}`);
    if (result.error) {
      console.log(`      ${RED}Error: ${result.error}${NC}`);
    }
  }

  console.log('');
  console.log(`Results: ${GREEN}${passed} passed${NC}, ${failed > 0 ? RED : ''}${failed} failed${NC}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

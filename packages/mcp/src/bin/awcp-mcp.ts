#!/usr/bin/env node
/**
 * AWCP MCP Server CLI
 *
 * Starts an MCP server that provides AWCP delegation tools.
 * Connects to a running Delegator Daemon.
 *
 * Usage:
 *   awcp-mcp [--daemon-url URL]
 *
 * Options:
 *   --daemon-url  URL of Delegator Daemon (default: http://localhost:3100)
 *   --help        Show this help message
 *
 * Example:
 *   awcp-mcp --daemon-url http://localhost:3100
 *
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "awcp": {
 *         "command": "npx",
 *         "args": ["awcp-mcp", "--daemon-url", "http://localhost:3100"]
 *       }
 *     }
 *   }
 */

import { createAwcpMcpServer } from '../server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let daemonUrl = 'http://localhost:3100';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--daemon-url' && args[i + 1]) {
      daemonUrl = args[i + 1]!;
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.error(`AWCP MCP Server

Provides MCP tools for workspace delegation:
  - delegate: Delegate a local directory to a remote Executor
  - delegate_output: Get delegation status/results
  - delegate_cancel: Cancel active delegations

Usage:
  awcp-mcp [options]

Options:
  --daemon-url URL  Delegator Daemon URL (default: http://localhost:3100)
  --help, -h        Show this help message

Example:
  awcp-mcp --daemon-url http://localhost:3100

Claude Desktop config:
  {
    "mcpServers": {
      "awcp": {
        "command": "npx",
        "args": ["awcp-mcp", "--daemon-url", "http://localhost:3100"]
      }
    }
  }
`);
      process.exit(0);
    }
  }

  // Create server
  const server = createAwcpMcpServer({ daemonUrl });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error(`[AWCP MCP] Server started, connected to daemon at ${daemonUrl}`);
}

main().catch((error) => {
  console.error('[AWCP MCP] Fatal error:', error);
  process.exit(1);
});

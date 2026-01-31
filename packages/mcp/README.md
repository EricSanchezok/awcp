# @awcp/mcp

MCP (Model Context Protocol) server that provides workspace delegation tools for AI agents.

## Overview

This package enables AI agents (like Claude) to delegate workspaces to remote Executor agents via the AWCP protocol. It automatically manages a Delegator Daemon and provides three MCP tools:

- **`delegate`** — Delegate a workspace to a remote Executor
- **`delegate_output`** — Get delegation status/results  
- **`delegate_cancel`** — Cancel active delegations

## Installation

```bash
npm install @awcp/mcp
```

Or use directly with npx:

```bash
npx @awcp/mcp --peers http://executor:4001
```

## Quick Start

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "awcp": {
      "command": "npx",
      "args": ["@awcp/mcp", "--peers", "http://localhost:10200"]
    }
  }
}
```

Restart Claude Desktop, then you can ask:

> "Use the delegate tool to ask another agent to add tests to ./src"

### Multiple Executors

```json
{
  "mcpServers": {
    "awcp": {
      "command": "npx",
      "args": [
        "@awcp/mcp",
        "--peers", "http://coding-agent:10200,http://review-agent:10201"
      ]
    }
  }
}
```

## CLI Options

### Daemon Options

| Option | Default | Description |
|--------|---------|-------------|
| `--daemon-url URL` | (auto-start) | Use existing Delegator Daemon instead of auto-starting |
| `--port PORT` | `3100` | Port for auto-started daemon |

### Peer Discovery

| Option | Default | Description |
|--------|---------|-------------|
| `--peers URL,...` | (none) | Comma-separated list of Executor base URLs |

The `--peers` flag fetches A2A Agent Cards at startup, providing the LLM with context about available executors and their capabilities.

### Export Options

| Option | Default | Description |
|--------|---------|-------------|
| `--exports-dir DIR` | `~/.awcp/exports` | Directory for workspace exports |
| `--export-strategy TYPE` | `symlink` | Export strategy: `symlink`, `bind`, or `worktree` |

### Transport Options

| Option | Default | Description |
|--------|---------|-------------|
| `--transport TYPE` | `archive` | Transport type: `archive` or `sshfs` |

**Archive transport** (default) — Best for remote executors over network:
| Option | Default | Description |
|--------|---------|-------------|
| `--temp-dir DIR` | `~/.awcp/temp` | Temp directory for archives |

**SSHFS transport** — Best for local executors with low latency:
| Option | Default | Description |
|--------|---------|-------------|
| `--ssh-ca-key PATH` | (required) | CA private key path |
| `--ssh-host HOST` | `localhost` | SSH server host |
| `--ssh-port PORT` | `22` | SSH server port |
| `--ssh-user USER` | (current user) | SSH username |
| `--ssh-key-dir DIR` | `~/.awcp/keys` | SSH key directory |

### Admission Control

| Option | Default | Description |
|--------|---------|-------------|
| `--max-total-bytes N` | `100MB` | Max workspace size |
| `--max-file-count N` | `10000` | Max number of files |
| `--max-single-file-bytes N` | `50MB` | Max single file size |

### Delegation Defaults

| Option | Default | Description |
|--------|---------|-------------|
| `--default-ttl SECONDS` | `3600` | Default lease duration |
| `--default-access-mode MODE` | `rw` | Default access: `ro` or `rw` |

## MCP Tools

### `delegate`

Delegate a workspace to a remote Executor for collaborative task execution.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | ✓ | Short task description (for logs) |
| `prompt` | string | ✓ | Full task instructions |
| `workspace_dir` | string | ✓ | Local directory path to delegate |
| `peer_url` | string | ✓ | Executor's AWCP endpoint URL |
| `ttl_seconds` | number | | Lease duration (default: 3600) |
| `access_mode` | `ro` \| `rw` | | Access mode (default: rw) |
| `background` | boolean | | If true, returns immediately |

**Example:**

```
delegate(
  description: "Add unit tests",
  prompt: "Add comprehensive unit tests for UserService class...",
  workspace_dir: "/Users/me/project",
  peer_url: "http://localhost:10200/awcp",
  background: true
)
```

### `delegate_output`

Get delegation status or wait for completion.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `delegation_id` | string | ✓ | Delegation ID |
| `block` | boolean | | Wait for completion if still running |
| `timeout` | number | | Max seconds to wait (default: 60) |

**Example:**

```
delegate_output(
  delegation_id: "del_abc123",
  block: true,
  timeout: 120
)
```

### `delegate_cancel`

Cancel active delegations.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `delegation_id` | string | | Specific delegation to cancel |
| `all` | boolean | | Cancel all active delegations |

**Example:**

```
delegate_cancel(delegation_id: "del_abc123")
# or
delegate_cancel(all: true)
```

## Programmatic Usage

```typescript
import { createAwcpMcpServer } from '@awcp/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createAwcpMcpServer({
  daemonUrl: 'http://localhost:3100',
  peers: {
    peers: [
      { url: 'http://localhost:10200', awcpUrl: 'http://localhost:10200/awcp', card: agentCard }
    ],
    summary: '...'
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Configuration Examples

### Basic Local Development

```bash
awcp-mcp --peers http://localhost:10200
```

### Production with Custom Limits

```bash
awcp-mcp \
  --peers http://agent1.example.com:10200,http://agent2.example.com:10200 \
  --max-total-bytes 500000000 \
  --max-file-count 50000 \
  --default-ttl 7200
```

### SSHFS Transport (Low Latency)

```bash
awcp-mcp \
  --peers http://localhost:10200 \
  --transport sshfs \
  --ssh-ca-key ~/.awcp/ca
```

### Claude Desktop with Full Options

```json
{
  "mcpServers": {
    "awcp": {
      "command": "npx",
      "args": [
        "@awcp/mcp",
        "--peers", "http://localhost:10200",
        "--port", "3100",
        "--exports-dir", "/tmp/awcp/exports",
        "--temp-dir", "/tmp/awcp/temp",
        "--max-total-bytes", "200000000",
        "--default-ttl", "7200"
      ]
    }
  }
}
```

## How It Works

1. **Startup**: MCP server starts and auto-launches Delegator Daemon
2. **Peer Discovery**: Fetches Agent Cards from `--peers` URLs
3. **Tool Registration**: Registers delegation tools with peer context
4. **Delegation Flow**:
   - LLM calls `delegate` tool
   - Daemon exports workspace and sends INVITE to Executor
   - Executor mounts/extracts workspace and executes task
   - Results are returned via SSE events
   - Workspace changes are synced back (Archive transport)

## Troubleshooting

### "Daemon not responding"

Check if port 3100 is available or specify a different port:

```bash
awcp-mcp --port 3200
```

### "Agent Card not found"

Ensure the Executor is running and accessible:

```bash
curl http://localhost:10200/.well-known/agent-card.json
```

### "Workspace too large"

Increase limits or exclude large directories:

```bash
awcp-mcp --max-total-bytes 500000000
```

Note: `node_modules/` and `.git/` are automatically excluded.

## Related

- [@awcp/sdk](../sdk) — Delegator and Executor implementations
- [@awcp/core](../core) — Protocol types and errors
- [@awcp/transport-archive](../transport-archive) — Archive transport
- [@awcp/transport-sshfs](../transport-sshfs) — SSHFS transport

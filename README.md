# AWCP - Agent Workspace Collaboration Protocol

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

AWCP enables secure workspace delegation between AI agents. A Delegator agent can share a local directory with an Executor agent, who can then read/write files using their native tools - as if the workspace were local.

## Key Features

- **Transparent Workspace Access**: Executor uses native tools (read, write, shell) on delegated workspace
- **Secure by Design**: Lease-based sessions, temporary SSH keys, policy-controlled mount points
- **MCP Integration**: Use AWCP directly from Claude or other MCP-compatible AI agents
- **Built on A2A**: Uses [Agent2Agent Protocol](https://github.com/a2aproject/A2A) for agent communication
- **Dual Transport**: Archive (HTTP+ZIP) or SSHFS data plane

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| `@awcp/core` | Protocol types, state machine, errors | — |
| `@awcp/sdk` | Delegator and Executor service implementations | — |
| `@awcp/transport-archive` | Archive transport (HTTP + ZIP) | — |
| `@awcp/transport-sshfs` | SSHFS transport (SSH + mount) | — |
| `@awcp/mcp` | MCP tools for AI agents | [README](packages/mcp/README.md) |

## Quick Start

### Option 1: MCP Tools (for Claude Desktop)

Add to your Claude Desktop config:

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

Then Claude can delegate tasks:

> "Use the delegate tool to ask another agent to review the code in ./src"

**Common Options:**

```json
{
  "mcpServers": {
    "awcp": {
      "command": "npx",
      "args": [
        "@awcp/mcp",
        "--peers", "http://agent1:10200,http://agent2:10201",
        "--max-total-bytes", "200000000",
        "--default-ttl", "7200"
      ]
    }
  }
}
```

See [@awcp/mcp README](packages/mcp/README.md) for all options.

### Option 2: Programmatic SDK

```bash
npm install @awcp/sdk
```

**Delegator side:**

```typescript
import { startDelegatorDaemon, DelegatorDaemonClient } from '@awcp/sdk';

// Start daemon
const daemon = await startDelegatorDaemon({
  port: 3100,
  delegator: {
    export: { baseDir: '/tmp/awcp/exports' },
  },
});

// Create delegation
const client = new DelegatorDaemonClient('http://localhost:3100');
const { delegationId } = await client.delegate({
  executorUrl: 'http://executor-agent:10200/awcp',
  localDir: '/path/to/workspace',
  task: {
    description: 'Review and fix bugs',
    prompt: 'Please review the code and fix any issues...',
  },
});

// Wait for result
const result = await client.waitForCompletion(delegationId);
console.log(result.result?.summary);
```

**Executor side:**

```typescript
import express from 'express';
import { executorHandler } from '@awcp/sdk/server/express';

const app = express();

app.use('/awcp', executorHandler({
  executor: myAgentExecutor,  // Your A2A AgentExecutor
  config: {
    workDir: '/tmp/awcp/workdir',
    tempDir: '/tmp/awcp/temp',
  },
}));

app.listen(10200);
```

## Protocol Flow

```
Delegator                              Executor
    |                                      |
    |  1. INVITE (task, constraints)       |
    |------------------------------------->|
    |                                      | 2. Policy check
    |  3. ACCEPT (mount_point)             |
    |<-------------------------------------|
    |                                      |
    | 4. Create export & credentials       |
    |  5. START (archive_url / ssh_cred)   |
    |------------------------------------->|
    |                                      | 6. Download/Mount workspace
    |                                      | 7. Execute task
    |  8. DONE (summary)                   |
    |<-------------------------------------|
    |                                      |
    | 9. Sync changes & cleanup            |
```

## Transports

### Archive Transport (Default)

Best for remote executors over network. Workspace is packaged as ZIP, transferred via HTTP.

```bash
awcp-mcp --transport archive --peers http://remote-executor:10200
```

### SSHFS Transport

Best for local executors with low latency. Uses SSH certificates for secure mount.

```bash
# Requires setup first
npx @awcp/transport-sshfs setup --auto

# Then use
awcp-mcp --transport sshfs --ssh-ca-key ~/.awcp/ca --peers http://localhost:10200
```

## Running Experiments

```bash
# Clone and install
git clone https://github.com/anthropics/awcp.git
cd awcp && npm install && npm run build

# Run basic delegation test
cd experiments/scenarios/01-local-basic && ./run.sh

# Run admission control test  
cd experiments/scenarios/02-admission-test && ./run.sh

# Run MCP integration test
cd experiments/scenarios/03-mcp-integration && ./run.sh

# Run Synergy executor test (requires Synergy CLI)
cd experiments/scenarios/05-synergy-executor && ./run.sh
```

## Requirements

- Node.js 18+
- For SSHFS transport:
  - macOS: `brew install macfuse && brew install sshfs`
  - Linux: `apt install sshfs`

## Documentation

- [Protocol Specification](docs/v1.md) — Full protocol design
- [MCP Tools Reference](packages/mcp/README.md) — Detailed MCP configuration
- [Development Guide](AGENTS.md) — For contributors

## Examples

- [synergy-executor](examples/synergy-executor) — Full Executor implementation using Synergy AI agent

## License

Apache 2.0 — See [LICENSE](LICENSE)

## Related

- [A2A Protocol](https://github.com/a2aproject/A2A) — Agent-to-agent communication
- [MCP](https://github.com/modelcontextprotocol/specification) — Model Context Protocol
- [Synergy](https://github.com/anthropics/holos-synergy) — AI coding agent

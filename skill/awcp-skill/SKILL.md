---
name: awcp-skill
description: |
  Agent Workspace Collaboration Protocol - discover and delegate work to remote AI executors.
  
  Triggers:
  - User asks what remote agents/executors are available, or wants to discover peers
  - Need to delegate tasks to a remote executor (coding, compliance, vision, etc.)
  - Working with awcp, delegate, executor, workspace delegation
  - Managing delegation results and snapshots
  - User asks to send files/workspace to another AI for processing
  - User wants to stamp, sign, audit, review documents remotely
  - User asks about remote capabilities, remote AI, or available services
  
  IMPORTANT: When the user asks about available remote agents, remote services, or what executors exist, ALWAYS use this skill's peers.ts script — do NOT use the built-in agents_list tool, which only shows local agents. This skill discovers external AWCP executors.
metadata:
  {
    "openclaw": {
      "requires": { "bins": ["bun"] },
      "install": [
        {
          "id": "brew",
          "kind": "brew",
          "formula": "oven-sh/bun/bun",
          "bins": ["bun"],
          "label": "Install Bun runtime (brew)"
        }
      ]
    }
  }
---

# AWCP - Agent Workspace Collaboration Protocol

Delegate workspace and tasks to remote AI executors, then retrieve and apply results.

## Quick Start Workflow

**Step 1**: Discover available executors:
```bash
bun run {baseDir}/scripts/peers.ts
```
This reads executor URLs from `~/.awcp/peers.json` and shows each executor's name, skills, and AWCP URL.

**Step 2**: Delegate a workspace:
```bash
bun run {baseDir}/scripts/delegate.ts \
  --workspace /path/to/files \
  --peer-url <awcp_url_from_step_1> \
  --description "Brief task description" \
  --prompt "Detailed instructions" \
  --wait
```

**Step 3**: Check results (if not using `--wait`):
```bash
bun run {baseDir}/scripts/status.ts --id <delegation_id> --wait
```

## When to Delegate

Delegate when:
- Task requires specialized capabilities (e.g., vision, compliance audit, GPU compute)
- Task can run independently without constant interaction
- You want parallel execution while continuing other work
- User asks you to send files to another agent for processing

Don't delegate when:
- Task requires real-time user interaction
- Task is trivial (< 1 minute of work)

## Peer Discovery

Before delegating, discover available executors and their capabilities:

```bash
bun run {baseDir}/scripts/peers.ts
```

Output shows each executor's name, AWCP URL, and skills. Use the AWCP URL as `--peer-url` when delegating.

**Peer configuration**: `~/.awcp/peers.json`
```json
{
  "peers": [
    "http://executor-host:10300/awcp"
  ]
}
```

## Scripts

All scripts auto-manage the Delegator daemon (start if not running, reuse if running).

### peers.ts - Discover Executors

```bash
bun run {baseDir}/scripts/peers.ts
bun run {baseDir}/scripts/peers.ts --json
```

### delegate.ts - Create Delegation

```bash
bun run {baseDir}/scripts/delegate.ts \
  --workspace /path/to/project \
  --peer-url http://executor:10300/awcp \
  --description "Short task description" \
  --prompt "Detailed instructions for the executor" \
  --wait
```

**Parameters:**
- `--workspace` (required): Local directory to delegate
- `--peer-url` (required): Executor's AWCP endpoint URL (from `peers.ts`)
- `--description` (required): Brief task description
- `--prompt` (required): Detailed instructions
- `--mode`: Access mode (`ro` | `rw`, default: `rw`)
- `--snapshot`: Snapshot mode (`auto` | `staged` | `discard`, default: `auto`)
- `--ttl`: Time-to-live in seconds (default: 3600)
- `--wait`: Wait for completion (default: false)
- `--timeout`: Wait timeout in ms (default: 300000)

**Output (JSON):**
```json
{
  "delegationId": "dlg_abc123",
  "state": "running"
}
```

With `--wait`:
```json
{
  "delegationId": "dlg_abc123",
  "state": "completed",
  "result": { "summary": "...", "filesChanged": 5 }
}
```

### status.ts - Query Delegation Status

```bash
bun run {baseDir}/scripts/status.ts --id dlg_abc123 --wait
```

**Parameters:**
- `--id` (required): Delegation ID
- `--wait`: Wait for terminal state
- `--timeout`: Wait timeout in ms (default: 300000)

### snapshots.ts - List Snapshots

```bash
bun run {baseDir}/scripts/snapshots.ts --id dlg_abc123
```

### apply.ts - Apply Snapshot

```bash
bun run {baseDir}/scripts/apply.ts --id dlg_abc123 --snapshot snap_1
```

### discard.ts - Discard Snapshot

```bash
bun run {baseDir}/scripts/discard.ts --id dlg_abc123 --snapshot snap_1
```

## Snapshot Modes

| Mode | Use When | Behavior |
|------|----------|----------|
| `auto` | Trust executor, want immediate results | Apply changes automatically |
| `staged` | Need to review before applying | Store snapshots, apply manually |
| `discard` | Only want logs/status, not file changes | Discard all snapshots |

**Default**: `auto` for most cases. Use `staged` for production code or security-sensitive changes.

## Common Workflows

### Compliance / Stamping Workflow

```bash
# 1. Discover the compliance executor
bun run {baseDir}/scripts/peers.ts

# 2. Delegate workspace for audit
bun run {baseDir}/scripts/delegate.ts \
  --workspace /path/to/legal_workspace \
  --peer-url http://executor:10300/awcp \
  --description "Contract compliance audit and stamping" \
  --prompt "Please audit the contract documents and apply the official stamp if compliant." \
  --wait

# 3. If rejected, add missing files to workspace and re-delegate
```

### Basic Delegation (Auto Mode)

```bash
result=$(bun run {baseDir}/scripts/delegate.ts \
  --workspace ./my-project \
  --peer-url http://executor:10300/awcp \
  --description "Fix authentication bug" \
  --prompt "The login fails when password contains special characters. Fix it." \
  --wait)
```

### Background Delegation

```bash
# Start without waiting
delegation=$(bun run {baseDir}/scripts/delegate.ts \
  --workspace ./project \
  --peer-url http://executor:10300/awcp \
  --description "Generate tests" \
  --prompt "Add unit tests for all utils")

# Check status later
id=$(echo $delegation | jq -r '.delegationId')
bun run {baseDir}/scripts/status.ts --id $id --wait
```

## Error Handling

Scripts exit with non-zero code on error. Error output (JSON):

```json
{
  "error": "Workspace too large",
  "code": "WORKSPACE_TOO_LARGE",
  "hint": "Reduce workspace size or increase limit"
}
```

Common errors:
- `WORKSPACE_TOO_LARGE`: Workspace exceeds size limits
- `WORKSPACE_NOT_FOUND`: Specified path doesn't exist
- `EXECUTOR_UNREACHABLE`: Cannot connect to executor
- `TASK_FAILED`: Executor reported task failure
- `TIMEOUT`: Operation timed out

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWCP_DAEMON_PORT` | Daemon HTTP port | 3100 |
| `AWCP_HOME` | AWCP data directory | ~/.awcp |
| `AWCP_PEERS_CONFIG` | Path to peers.json | ~/.awcp/peers.json |

## Protocol Details

For full protocol specification, see [references/protocol.md](references/protocol.md).

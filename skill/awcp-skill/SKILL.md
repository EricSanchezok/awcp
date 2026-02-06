---
name: awcp-skill
description: |
  Agent Workspace Collaboration Protocol - delegate work to remote AI executors.
  
  Triggers:
  - Need to delegate coding tasks to a remote executor
  - Working with awcp, delegate, executor, workspace delegation
  - Managing delegation results and snapshots
  - Choosing between auto/staged/discard snapshot modes
  
  Use this skill when you need to send work to a remote AI agent and manage the results.
---

# AWCP - Agent Workspace Collaboration Protocol

Delegate workspace and tasks to remote AI executors, then retrieve and apply results.

## Quick Decision Guide

### When to Delegate

Delegate when:
- Task requires specialized capabilities (e.g., browser automation, GPU compute)
- Task can run independently without constant interaction
- You want parallel execution while continuing other work

Don't delegate when:
- Task requires real-time user interaction
- Task is trivial (< 1 minute of work)
- Sensitive data that shouldn't leave local machine

### Snapshot Mode Selection

| Mode | Use When | Behavior |
|------|----------|----------|
| `auto` | Trust executor, want immediate results | Apply changes automatically |
| `staged` | Need to review before applying | Store snapshots, apply manually |
| `discard` | Only want logs/status, not file changes | Discard all snapshots |

**Default**: `auto` for most cases. Use `staged` for production code or security-sensitive changes.

## Scripts

All scripts auto-manage the Delegator daemon (start if not running, reuse if running).

### delegate.ts - Create Delegation

```bash
bun run scripts/delegate.ts \
  --workspace /path/to/project \
  --peer-url http://executor.example.com/awcp \
  --description "Short task description" \
  --prompt "Detailed instructions for the executor"
```

**Parameters:**
- `--workspace` (required): Local directory to delegate
- `--peer-url` (required): Executor's AWCP endpoint URL
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
bun run scripts/status.ts --id dlg_abc123
```

**Parameters:**
- `--id` (required): Delegation ID
- `--wait`: Wait for terminal state
- `--timeout`: Wait timeout in ms (default: 300000)

**Output (JSON):**
```json
{
  "id": "dlg_abc123",
  "state": "completed",
  "result": { "summary": "Refactored auth module", "filesChanged": 3 },
  "snapshots": [{ "id": "snap_1", "status": "applied" }]
}
```

### snapshots.ts - List Snapshots

```bash
bun run scripts/snapshots.ts --id dlg_abc123
```

**Output (JSON):**
```json
{
  "delegationId": "dlg_abc123",
  "snapshots": [
    { "id": "snap_1", "status": "pending", "summary": "Initial changes" },
    { "id": "snap_2", "status": "pending", "summary": "Additional fixes" }
  ]
}
```

### apply.ts - Apply Snapshot

```bash
bun run scripts/apply.ts --id dlg_abc123 --snapshot snap_1
```

**Parameters:**
- `--id` (required): Delegation ID
- `--snapshot` (required): Snapshot ID to apply

Applies the snapshot's changes to your local workspace.

### discard.ts - Discard Snapshot

```bash
bun run scripts/discard.ts --id dlg_abc123 --snapshot snap_1
```

Discards a snapshot without applying its changes.

## Common Workflows

### Basic Delegation (Auto Mode)

```bash
# Delegate and wait for completion
result=$(bun run scripts/delegate.ts \
  --workspace ./my-project \
  --peer-url http://executor:4001/awcp \
  --description "Fix authentication bug" \
  --prompt "The login fails when password contains special characters. Fix it." \
  --wait)

echo $result
# Changes already applied to ./my-project
```

### Staged Review Workflow

```bash
# 1. Delegate with staged mode
bun run scripts/delegate.ts \
  --workspace ./my-project \
  --peer-url http://executor:4001/awcp \
  --description "Refactor database layer" \
  --prompt "Split the monolithic db.ts into separate modules" \
  --snapshot staged

# 2. Wait for completion
bun run scripts/status.ts --id dlg_abc123 --wait

# 3. Review available snapshots
bun run scripts/snapshots.ts --id dlg_abc123

# 4. Apply the one you want
bun run scripts/apply.ts --id dlg_abc123 --snapshot snap_1

# 5. Discard others
bun run scripts/discard.ts --id dlg_abc123 --snapshot snap_2
```

### Background Delegation

```bash
# Start delegation without waiting
delegation=$(bun run scripts/delegate.ts \
  --workspace ./project \
  --peer-url http://executor:4001/awcp \
  --description "Generate tests" \
  --prompt "Add unit tests for all utils")

# Extract delegation ID
id=$(echo $delegation | jq -r '.delegationId')

# ... do other work ...

# Check status later
bun run scripts/status.ts --id $id --wait
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

## Protocol Details

For full protocol specification, see [references/protocol.md](references/protocol.md).

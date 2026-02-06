# AWCP Protocol Reference

Condensed protocol specification for reference. See full spec at `docs/v1.md`.

## Protocol Flow

```
Delegator                              Executor
    │ ─── INVITE (sync) ─────────────► │
    │ ◄── ACCEPT ──────────────────────│
    │ ─── START ──────────────────────►│  → setup workspace
    │ ◄── {ok:true} ───────────────────│
    │ ─── GET /tasks/:id/events (SSE) ►│  → execute task
    │ ◄── event: status ───────────────│
    │ ◄── event: snapshot ─────────────│
    │ ◄── event: done ─────────────────│  → teardown
```

## State Machine

```
created → invited → accepted → started → running → completed
                                    ↘        ↘         ↓
                                   error ← cancelled ← expired
```

Terminal states: `completed`, `error`, `cancelled`, `expired`

## Message Types

### INVITE (Delegator → Executor)

```json
{
  "version": "1",
  "type": "INVITE",
  "delegationId": "dlg_abc123",
  "task": {
    "description": "Fix authentication bug",
    "prompt": "The login fails when..."
  },
  "lease": {
    "ttlSeconds": 3600,
    "accessMode": "rw"
  },
  "environment": {
    "resources": [{
      "name": "workspace",
      "type": "fs",
      "mode": "rw"
    }]
  },
  "transport": {
    "type": "archive",
    "archiveUrl": "http://..."
  }
}
```

### ACCEPT (Executor → Delegator)

```json
{
  "type": "ACCEPT",
  "executorInfo": {
    "name": "my-executor",
    "capabilities": ["code", "test"]
  }
}
```

### START (Delegator → Executor)

```json
{
  "type": "START",
  "taskId": "task_xyz"
}
```

## Task Events (SSE)

### Status Event
```json
{
  "type": "status",
  "taskId": "task_xyz",
  "status": "working",
  "message": "Analyzing codebase..."
}
```

### Snapshot Event
```json
{
  "type": "snapshot",
  "taskId": "task_xyz",
  "snapshotId": "snap_1",
  "summary": "Initial changes",
  "snapshotBase64": "..."
}
```

### Done Event
```json
{
  "type": "done",
  "taskId": "task_xyz",
  "result": {
    "summary": "Fixed auth bug",
    "filesChanged": 3
  },
  "recommendedSnapshotId": "snap_1"
}
```

### Error Event
```json
{
  "type": "error",
  "taskId": "task_xyz",
  "error": {
    "code": "TASK_FAILED",
    "message": "Could not complete task"
  }
}
```

## Transport Types

| Type | Description |
|------|-------------|
| `archive` | HTTP download of ZIP archive |
| `sshfs` | SSH filesystem mount |
| `storage` | S3/HTTP with pre-signed URLs |
| `git` | Git clone/push |

## Snapshot Modes

| Mode | Behavior |
|------|----------|
| `auto` | Apply snapshots immediately as received |
| `staged` | Store snapshots for manual review/apply |
| `discard` | Discard all snapshots (logs only) |

## Error Codes

| Code | Description |
|------|-------------|
| `DECLINED` | Executor declined the invitation |
| `WORKSPACE_TOO_LARGE` | Workspace exceeds size limits |
| `WORKSPACE_NOT_FOUND` | Workspace path doesn't exist |
| `WORKSPACE_INVALID` | Invalid workspace configuration |
| `TASK_FAILED` | Task execution failed |
| `TRANSPORT_ERROR` | Transport setup/teardown failed |
| `TIMEOUT` | Operation timed out |

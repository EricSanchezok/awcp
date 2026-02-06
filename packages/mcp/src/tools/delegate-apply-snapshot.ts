/**
 * delegate_apply_snapshot tool - Apply a staged snapshot to local workspace
 */

import { z } from 'zod';

export const delegateApplySnapshotSchema = z.object({
  delegation_id: z
    .string()
    .describe('Delegation ID'),
  snapshot_id: z
    .string()
    .describe('Snapshot ID to apply'),
});

export type DelegateApplySnapshotParams = z.infer<typeof delegateApplySnapshotSchema>;

export const delegateApplySnapshotDescription = `Apply a staged snapshot to the local workspace.

Extracts the snapshot contents and overwrites the original workspace files with the executor's changes.

## When to use

- After reviewing snapshots with delegate_snapshots
- When you want to accept the executor's work
- Only works with snapshot_mode='staged' delegations

## Caution

This permanently modifies your local files. The snapshot replaces files in the workspace.

## Example

\`\`\`
delegate_apply_snapshot(delegation_id: "dlg_abc", snapshot_id: "snap_1")
→ "Snapshot applied successfully"
\`\`\`
`;

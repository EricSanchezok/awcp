/**
 * delegate_discard_snapshot tool - Discard a staged snapshot
 */

import { z } from 'zod';

export const delegateDiscardSnapshotSchema = z.object({
  delegation_id: z
    .string()
    .describe('Delegation ID'),
  snapshot_id: z
    .string()
    .describe('Snapshot ID to discard'),
});

export type DelegateDiscardSnapshotParams = z.infer<typeof delegateDiscardSnapshotSchema>;

export const delegateDiscardSnapshotDescription = `Discard a staged snapshot without applying it.

Removes the snapshot from disk. Use this when you don't want the executor's changes.

## When to use

- After reviewing snapshots with delegate_snapshots
- When the executor's work doesn't meet requirements
- To clean up snapshots you don't need

## Example

\`\`\`
delegate_discard_snapshot(delegation_id: "dlg_abc", snapshot_id: "snap_2")
→ "Snapshot discarded"
\`\`\`
`;

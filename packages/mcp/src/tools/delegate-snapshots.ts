/**
 * delegate_snapshots tool - List snapshots for a delegation
 */

import { z } from 'zod';

export const delegateSnapshotsSchema = z.object({
  delegation_id: z
    .string()
    .describe('Delegation ID to list snapshots for'),
});

export type DelegateSnapshotsParams = z.infer<typeof delegateSnapshotsSchema>;

export const delegateSnapshotsDescription = `List all snapshots received from a delegation.

Returns snapshot metadata including:
- Snapshot ID, summary, and highlights
- Status: pending (awaiting decision), applied, or discarded
- Whether the executor recommends this snapshot
- File count and size statistics

Use this to review available snapshots before applying or discarding them.

## When to use

- After a delegation completes with snapshot_mode='staged'
- To check which snapshot was auto-applied (snapshot_mode='auto')
- To review multiple snapshots and decide which to apply

## Example

\`\`\`
delegate_snapshots(delegation_id: "dlg_abc123")
→ [
    { id: "snap_1", summary: "Fixed auth bug", status: "pending", recommended: true },
    { id: "snap_2", summary: "Also updated tests", status: "pending" }
  ]
\`\`\`
`;

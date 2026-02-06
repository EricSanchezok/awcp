/**
 * delegate_recover tool - Recover results from a disconnected delegation
 */

import { z } from 'zod';

export const delegateRecoverSchema = z.object({
  delegation_id: z
    .string()
    .describe('Delegation ID to recover'),
  peer_url: z
    .string()
    .url()
    .describe('URL of the Executor that ran the task'),
});

export type DelegateRecoverParams = z.infer<typeof delegateRecoverSchema>;

export const delegateRecoverDescription = `Recover results from a delegation after connection loss.

If the SSE connection dropped during task execution, use this to fetch the final result from the Executor.

## When to use

- After network interruption during a delegation
- When delegate_output shows 'error' with SSE_FAILED
- To retrieve results that were generated but not received

## Note

Only works if the Executor still has the result cached. Results may expire after some time.

## Example

\`\`\`
delegate_recover(delegation_id: "dlg_abc", peer_url: "http://executor:4001/awcp")
→ { status: "completed", summary: "Fixed the bug", ... }
\`\`\`
`;

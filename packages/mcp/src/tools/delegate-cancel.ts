/**
 * delegate_cancel tool - Cancel an active delegation
 *
 * This will terminate the delegation, unmount the remote filesystem,
 * revoke credentials, and clean up resources.
 */

import { z } from 'zod';

export const delegateCancelSchema = z.object({
  delegation_id: z
    .string()
    .optional()
    .describe('Specific delegation ID to cancel'),
  all: z
    .boolean()
    .optional()
    .describe('Cancel all active delegations'),
});

export type DelegateCancelParams = z.infer<typeof delegateCancelSchema>;

export const delegateCancelDescription = `Cancel active delegations.

## Parameters
- **delegation_id** (optional): Specific delegation ID to cancel
- **all** (optional): Cancel all active delegations

## Usage
Cancel a specific delegation:
\`\`\`
delegate_cancel(delegation_id: "dlg_abc123")
\`\`\`

Cancel all active delegations:
\`\`\`
delegate_cancel(all: true)
\`\`\`

## Notes
- Cancellation triggers cleanup: unmount, credential revocation, export removal
- The Executor will receive a cancellation signal
`;

/**
 * delegate_output tool - Retrieve output from a delegation
 *
 * Use this to check status or get results from a background delegation.
 */

import { z } from 'zod';

export const delegateOutputSchema = z.object({
  delegation_id: z
    .string()
    .describe('The delegation ID returned from delegate()'),
  block: z
    .boolean()
    .optional()
    .describe('Wait for completion if still running'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum seconds to wait when blocking (default: 60)'),
});

export type DelegateOutputParams = z.infer<typeof delegateOutputSchema>;

export const delegateOutputDescription = `Retrieve output from a delegation.

## Parameters
- **delegation_id** (required): Delegation ID from delegate()
- **block** (optional): Wait for completion if still running
- **timeout** (optional): Maximum seconds to wait (default: 60)

## Usage
After launching a background delegation:
\`\`\`
delegate(background: true, ...) → "Delegation ID: dlg_abc123..."
\`\`\`

Check or retrieve results:
\`\`\`
delegate_output(delegation_id: "dlg_abc123")
\`\`\`

Wait for completion:
\`\`\`
delegate_output(delegation_id: "dlg_abc123", block: true, timeout: 120)
\`\`\`
`;

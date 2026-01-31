/**
 * delegate_output tool - Retrieve output from a delegation
 *
 * Use this to check status or get results from a background delegation.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const delegateOutputSchema = z.object({
  delegation_id: z
    .string()
    .describe('Delegation ID from the background delegation launch'),
  block: z
    .boolean()
    .optional()
    .describe('Wait for completion if still running'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max seconds to wait (default: 60)'),
});

export type DelegateOutputParams = z.infer<typeof delegateOutputSchema>;

export const delegateOutputDescription = readFileSync(
  join(__dirname, 'delegate-output.txt'),
  'utf-8'
);

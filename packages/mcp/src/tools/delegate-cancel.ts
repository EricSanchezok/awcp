/**
 * delegate_cancel tool - Cancel background delegations
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const delegateCancelSchema = z.object({
  delegation_id: z
    .string()
    .optional()
    .describe('Specific delegation ID to cancel'),
  all: z
    .boolean()
    .optional()
    .describe('Cancel all running delegations'),
});

export type DelegateCancelParams = z.infer<typeof delegateCancelSchema>;

export const delegateCancelDescription = readFileSync(
  join(__dirname, 'delegate-cancel.txt'),
  'utf-8'
);

/**
 * delegate tool - Initiate a workspace delegation to a remote Executor
 *
 * This tool allows an AI agent to delegate a local directory to a remote
 * Executor agent for collaborative task execution.
 */

import { z } from 'zod';

export const delegateSchema = z.object({
  description: z
    .string()
    .describe('Short task description (for logs and listing)'),
  prompt: z
    .string()
    .describe('Full task instructions including goals and constraints'),
  workspace_dir: z
    .string()
    .describe('Local directory path to delegate to the Executor'),
  peer_url: z
    .string()
    .url()
    .describe('URL of the target Executor AWCP endpoint'),
  ttl_seconds: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Lease duration in seconds (default: 3600)'),
  access_mode: z
    .enum(['ro', 'rw'])
    .optional()
    .describe('Access mode: ro (read-only) or rw (read-write, default)'),
  background: z
    .boolean()
    .optional()
    .describe(
      'If true, returns immediately with delegation_id. ' +
        'If false (default), waits for task completion.'
    ),
});

export type DelegateParams = z.infer<typeof delegateSchema>;

export const delegateDescription = `Delegate a local workspace directory to a remote Executor agent.

## Parameters
- **description** (required): Short task description for logs
- **prompt** (required): Full task instructions with goals and constraints
- **workspace_dir** (required): Local directory path to delegate
- **peer_url** (required): Executor's AWCP endpoint URL
- **ttl_seconds** (optional): Lease duration (default: 3600)
- **access_mode** (optional): "ro" or "rw" (default: "rw")
- **background** (optional): Return immediately if true (default: false)

## Behavior
- **Sync mode (background=false)**: Waits for task completion, returns final_summary
- **Async mode (background=true)**: Returns delegation_id immediately

## Example
\`\`\`
delegate({
  description: "Fix TypeScript errors",
  prompt: "Find and fix all type errors in the src/ directory...",
  workspace_dir: "/path/to/project",
  peer_url: "http://executor:4001/awcp",
  background: true
})
\`\`\`
`;

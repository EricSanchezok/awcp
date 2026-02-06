/**
 * delegate tool - Initiate a workspace delegation to a remote Executor
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PeersContext } from '../peer-discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESCRIPTION_TEMPLATE = readFileSync(join(__dirname, 'delegate.txt'), 'utf-8');

const resourceSchema = z.object({
  name: z.string().describe('Resource name (e.g., "src", "data")'),
  path: z.string().describe('Local directory path'),
  mode: z.enum(['ro', 'rw']).optional().describe('Access mode (default: rw)'),
});

export const delegateSchema = z.object({
  description: z
    .string()
    .describe('Short task description (for logs and listing)'),
  prompt: z
    .string()
    .describe('Full task instructions including goals and constraints'),
  workspace_dir: z
    .string()
    .optional()
    .describe('Local directory path to delegate (for single-resource delegation)'),
  resources: z
    .array(resourceSchema)
    .optional()
    .describe('Multiple resources to delegate (alternative to workspace_dir)'),
  cwd: z
    .string()
    .optional()
    .describe('Working directory for resolving relative paths'),
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
    .describe('Default access mode: ro (read-only) or rw (read-write, default)'),
  snapshot_mode: z
    .enum(['auto', 'staged', 'discard'])
    .optional()
    .describe(
      'Snapshot handling: auto (apply immediately), staged (require manual apply), discard (ignore)'
    ),
  auth_type: z
    .enum(['api_key', 'bearer', 'oauth2'])
    .optional()
    .describe('Authentication type for the Executor'),
  auth_credential: z
    .string()
    .optional()
    .describe('Authentication credential (API key, bearer token, etc.)'),
  background: z
    .boolean()
    .optional()
    .describe(
      'If true, returns immediately with delegation_id. ' +
        'If false (default), waits for task completion.'
    ),
});

export type DelegateParams = z.infer<typeof delegateSchema>;

export function generateDelegateDescription(peers?: PeersContext): string {
  let executorsSection = '';

  if (peers && peers.peers.length > 0) {
    const availablePeers = peers.peers.filter(p => p.card);

    if (availablePeers.length > 0) {
      executorsSection = '## Available Executors';

      for (const peer of availablePeers) {
        const card = peer.card!;
        executorsSection += `\n\n### ${card.name}`;
        executorsSection += `\n- **URL**: \`${peer.awcpUrl}\``;

        if (card.description) {
          executorsSection += `\n- **Description**: ${card.description}`;
        }

        if (card.skills && card.skills.length > 0) {
          const skillNames = card.skills.map(s => s.name).join(', ');
          executorsSection += `\n- **Skills**: ${skillNames}`;
        }
      }
    }
  }

  return DESCRIPTION_TEMPLATE.replace('{executors}', executorsSection);
}

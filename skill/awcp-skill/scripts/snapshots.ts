#!/usr/bin/env bun
/**
 * snapshots.ts - List snapshots for a delegation
 * 
 * Usage:
 *   bun run snapshots.ts --id dlg_abc123
 */

import { getClient, parseArgs, output, error } from './lib/daemon.ts';

const USAGE = `
Usage: bun run snapshots.ts [options]

Required:
  --id <delegation_id>    Delegation ID

Optional:
  --help                  Show this help
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const id = args.id as string;

  if (!id) {
    console.error('Error: --id is required');
    console.error(USAGE);
    process.exit(1);
  }

  try {
    const client = await getClient();
    const { snapshots } = await client.listSnapshots(id);
    
    output({
      delegationId: id,
      snapshots,
    });
  } catch (err) {
    error(err);
  }
}

main();

#!/usr/bin/env bun
/**
 * discard.ts - Discard a snapshot without applying
 * 
 * Usage:
 *   bun run discard.ts --id dlg_abc123 --snapshot snap_1
 */

import { getClient, parseArgs, output, error } from './lib/daemon.ts';

const USAGE = `
Usage: bun run discard.ts [options]

Required:
  --id <delegation_id>    Delegation ID
  --snapshot <snapshot_id> Snapshot ID to discard

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
  const snapshotId = args.snapshot as string;

  if (!id || !snapshotId) {
    console.error('Error: --id and --snapshot are required');
    console.error(USAGE);
    process.exit(1);
  }

  try {
    const client = await getClient();
    await client.discardSnapshot(id, snapshotId);
    
    output({
      success: true,
      delegationId: id,
      snapshotId,
      message: 'Snapshot discarded',
    });
  } catch (err) {
    error(err);
  }
}

main();

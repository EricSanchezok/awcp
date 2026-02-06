#!/usr/bin/env bun
/**
 * apply.ts - Apply a snapshot to local workspace
 * 
 * Usage:
 *   bun run apply.ts --id dlg_abc123 --snapshot snap_1
 */

import { getClient, parseArgs, output, error } from './lib/daemon.ts';

const USAGE = `
Usage: bun run apply.ts [options]

Required:
  --id <delegation_id>    Delegation ID
  --snapshot <snapshot_id> Snapshot ID to apply

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
    await client.applySnapshot(id, snapshotId);
    
    output({
      success: true,
      delegationId: id,
      snapshotId,
      message: 'Snapshot applied successfully',
    });
  } catch (err) {
    error(err);
  }
}

main();

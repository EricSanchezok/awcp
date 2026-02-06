#!/usr/bin/env bun
/**
 * status.ts - Query delegation status
 * 
 * Usage:
 *   bun run status.ts --id dlg_abc123
 */

import { getClient, parseArgs, output, error } from './lib/daemon.ts';

const USAGE = `
Usage: bun run status.ts [options]

Required:
  --id <delegation_id>    Delegation ID to query

Optional:
  --wait                  Wait for terminal state
  --timeout <ms>          Wait timeout (default: 300000)
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

  const wait = !!args.wait;
  const timeout = args.timeout ? parseInt(args.timeout as string, 10) : 300000;

  try {
    const client = await getClient();

    if (wait) {
      const result = await client.waitForCompletion(id, 1000, timeout);
      output(result);
    } else {
      const delegation = await client.getDelegation(id);
      output(delegation);
    }
  } catch (err) {
    error(err);
  }
}

main();

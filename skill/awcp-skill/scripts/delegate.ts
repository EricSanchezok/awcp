#!/usr/bin/env bun
/**
 * delegate.ts - Create a new delegation
 * 
 * Usage:
 *   bun run delegate.ts --workspace /path --peer-url http://... --description "..." --prompt "..."
 */

import { getClient, parseArgs, output, error } from './lib/daemon.ts';
import { resolve } from 'node:path';

const USAGE = `
Usage: bun run delegate.ts [options]

Required:
  --workspace <path>      Local directory to delegate
  --peer-url <url>        Executor's AWCP endpoint URL
  --description <text>    Brief task description
  --prompt <text>         Detailed instructions for executor

Optional:
  --mode <ro|rw>          Access mode (default: rw)
  --snapshot <mode>       Snapshot mode: auto|staged|discard (default: auto)
  --ttl <seconds>         Time-to-live (default: 3600)
  --wait                  Wait for completion
  --timeout <ms>          Wait timeout (default: 300000)
  --help                  Show this help
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  // Validate required args
  const workspace = args.workspace as string;
  const peerUrl = args['peer-url'] as string;
  const description = args.description as string;
  const prompt = args.prompt as string;

  if (!workspace || !peerUrl || !description || !prompt) {
    console.error('Error: Missing required arguments');
    console.error(USAGE);
    process.exit(1);
  }

  const mode = (args.mode as 'ro' | 'rw') || 'rw';
  const snapshotMode = (args.snapshot as 'auto' | 'staged' | 'discard') || 'auto';
  const ttlSeconds = args.ttl ? parseInt(args.ttl as string, 10) : 3600;
  const wait = !!args.wait;
  const timeout = args.timeout ? parseInt(args.timeout as string, 10) : 300000;

  try {
    const client = await getClient();

    const { delegationId } = await client.delegate({
      executorUrl: peerUrl,
      environment: {
        resources: [{
          name: 'workspace',
          type: 'fs',
          source: resolve(workspace),
          mode,
        }],
      },
      task: { description, prompt },
      ttlSeconds,
      accessMode: mode,
      snapshotMode,
    });

    if (wait) {
      const result = await client.waitForCompletion(delegationId, 1000, timeout);
      output(result);
    } else {
      const delegation = await client.getDelegation(delegationId);
      output({
        delegationId,
        state: delegation.state,
      });
    }
  } catch (err) {
    error(err);
  }
}

main();

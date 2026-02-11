#!/usr/bin/env bun
/**
 * peers.ts - Discover available AWCP executor peers
 *
 * Reads peer URLs from ~/.awcp/peers.json, fetches Agent Cards,
 * and displays capabilities. Helps the agent choose the right executor.
 *
 * Usage:
 *   bun run peers.ts
 *   bun run peers.ts --json
 */

import { parseArgs, output, error } from './lib/daemon.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PEERS_CONFIG_PATH = process.env.AWCP_PEERS_CONFIG
  || join(process.env.AWCP_HOME || join(homedir(), '.awcp'), 'peers.json');

const AGENT_CARD_PATHS = [
  '/.well-known/agent-card.json',
  '/.well-known/agent.json',
];

interface PeerConfig {
  peers: string[];
}

interface AgentCard {
  name: string;
  description?: string;
  url: string;
  skills?: Array<{
    id: string;
    name: string;
    description: string;
    tags?: string[];
    examples?: string[];
  }>;
}

interface PeerInfo {
  url: string;
  awcpUrl: string;
  card?: AgentCard;
  error?: string;
}

async function loadPeerConfig(): Promise<string[]> {
  try {
    const content = await readFile(PEERS_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as PeerConfig;
    return config.peers || [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Peers config not found at ${PEERS_CONFIG_PATH}\n` +
        `Create it with: echo '{"peers":["http://executor-host:10300/awcp"]}' > ${PEERS_CONFIG_PATH}`
      );
    }
    throw err;
  }
}

function normalizeBaseUrl(peerUrl: string): string {
  let baseUrl = peerUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/awcp')) {
    baseUrl = baseUrl.slice(0, -5);
  }
  return baseUrl;
}

async function fetchAgentCard(baseUrl: string): Promise<AgentCard | null> {
  for (const path of AGENT_CARD_PATHS) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return await res.json() as AgentCard;
      }
    } catch {
      // Try next path
    }
  }
  return null;
}

async function discoverPeers(peerUrls: string[]): Promise<PeerInfo[]> {
  const peers: PeerInfo[] = [];

  for (const inputUrl of peerUrls) {
    const baseUrl = normalizeBaseUrl(inputUrl);
    const awcpUrl = `${baseUrl}/awcp`;

    try {
      const card = await fetchAgentCard(baseUrl);
      if (card) {
        peers.push({ url: baseUrl, awcpUrl, card });
      } else {
        peers.push({ url: baseUrl, awcpUrl, error: 'Agent Card not found (executor may be offline)' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      peers.push({ url: baseUrl, awcpUrl, error: msg });
    }
  }

  return peers;
}

function formatPeersSummary(peers: PeerInfo[]): string {
  const available = peers.filter(p => p.card);
  const unavailable = peers.filter(p => !p.card);

  if (available.length === 0 && unavailable.length === 0) {
    return 'No peers configured. Add executor URLs to ' + PEERS_CONFIG_PATH;
  }

  const lines: string[] = [];

  if (available.length > 0) {
    lines.push(`Available Executors (${available.length}):`);
    lines.push('');

    for (const peer of available) {
      const card = peer.card!;
      lines.push(`  ${card.name}`);
      lines.push(`    AWCP URL: ${peer.awcpUrl}`);
      if (card.description) {
        const desc = card.description.split('\n')[0];
        lines.push(`    Description: ${desc}`);
      }
      if (card.skills && card.skills.length > 0) {
        lines.push('    Skills:');
        for (const skill of card.skills) {
          lines.push(`      - ${skill.name}: ${skill.description}`);
        }
      }
      lines.push('');
    }
  }

  if (unavailable.length > 0) {
    lines.push(`Unavailable Peers (${unavailable.length}):`);
    for (const peer of unavailable) {
      lines.push(`  ${peer.url}: ${peer.error}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
Usage: bun run peers.ts [options]

Options:
  --json    Output raw JSON instead of formatted text
  --help    Show this help

Reads peer URLs from: ${PEERS_CONFIG_PATH}
`);
    process.exit(0);
  }

  try {
    const peerUrls = await loadPeerConfig();
    const peers = await discoverPeers(peerUrls);

    if (args.json) {
      output(peers);
    } else {
      console.log(formatPeersSummary(peers));
      process.exit(0);
    }
  } catch (err) {
    error(err);
  }
}

main();

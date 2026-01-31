/**
 * Peer Discovery - Fetches A2A Agent Cards from configured peers
 * 
 * Provides context to LLM about available executors and their capabilities.
 */

import type { AgentCard } from '@a2a-js/sdk';

export interface PeerInfo {
  /** Base URL of the peer (e.g., http://localhost:4001) */
  url: string;
  /** AWCP endpoint URL (e.g., http://localhost:4001/awcp) */
  awcpUrl: string;
  card?: AgentCard;
  error?: string;
}

export interface PeersContext {
  peers: PeerInfo[];
  summary: string;
}

/**
 * Fetch Agent Card from a peer URL
 * 
 * Tries both /.well-known/agent-card.json and /.well-known/agent.json
 * Returns the card and the normalized base URL
 */
async function fetchAgentCard(peerUrl: string): Promise<{ card: AgentCard; baseUrl: string } | null> {
  // Normalize URL (remove trailing slash, remove /awcp suffix)
  let baseUrl = peerUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/awcp')) {
    baseUrl = baseUrl.slice(0, -5);
  }

  // Try standard A2A paths
  const paths = [
    '/.well-known/agent-card.json',
    '/.well-known/agent.json',
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const card = await res.json() as AgentCard;
        return { card, baseUrl };
      }
    } catch {
      // Try next path
    }
  }

  return null;
}

/**
 * Normalize peer URL to base URL (without /awcp suffix)
 */
function normalizeBaseUrl(peerUrl: string): string {
  let baseUrl = peerUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/awcp')) {
    baseUrl = baseUrl.slice(0, -5);
  }
  return baseUrl;
}

/**
 * Discover all configured peers and fetch their Agent Cards
 */
export async function discoverPeers(peerUrls: string[]): Promise<PeersContext> {
  const peers: PeerInfo[] = [];

  for (const inputUrl of peerUrls) {
    const baseUrl = normalizeBaseUrl(inputUrl);
    const awcpUrl = `${baseUrl}/awcp`;
    
    try {
      const result = await fetchAgentCard(inputUrl);
      if (result) {
        peers.push({ url: result.baseUrl, awcpUrl, card: result.card });
        console.error(`[AWCP] Discovered peer: ${result.card.name} at ${result.baseUrl}`);
      } else {
        peers.push({ url: baseUrl, awcpUrl, error: 'Agent Card not found' });
        console.error(`[AWCP] Peer ${baseUrl}: Agent Card not found`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      peers.push({ url: baseUrl, awcpUrl, error: msg });
      console.error(`[AWCP] Peer ${baseUrl}: ${msg}`);
    }
  }

  const summary = generatePeersSummary(peers);
  return { peers, summary };
}

/**
 * Generate a human-readable summary of available peers
 */
function generatePeersSummary(peers: PeerInfo[]): string {
  const availablePeers = peers.filter(p => p.card);
  
  if (availablePeers.length === 0) {
    return 'No executor peers available. Configure peers with --peers flag.';
  }

  const lines: string[] = [
    `Available Executor Agents (${availablePeers.length}):`,
    '',
  ];

  for (const peer of availablePeers) {
    const card = peer.card!;
    lines.push(`## ${card.name}`);
    lines.push(`URL: ${peer.url}`);
    if (card.description) {
      lines.push(`Description: ${card.description}`);
    }
    
    if (card.skills && card.skills.length > 0) {
      lines.push('Skills:');
      for (const skill of card.skills) {
        lines.push(`  - ${skill.name}: ${skill.description}`);
        if (skill.examples && skill.examples.length > 0) {
          lines.push(`    Examples: ${skill.examples.slice(0, 2).join('; ')}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('Use the `delegate` tool to delegate workspace tasks to these agents.');

  return lines.join('\n');
}

/**
 * Format peers context for MCP resource
 */
export function formatPeersAsResource(context: PeersContext): string {
  return context.summary;
}

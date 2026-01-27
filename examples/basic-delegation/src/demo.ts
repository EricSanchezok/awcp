/**
 * AWCP Demo - Complete flow demonstration
 * 
 * This demo shows the full AWCP protocol flow in a single process,
 * simulating both Host and Remote communication.
 */

import {
  HostDaemon,
  RemoteDaemon,
  type AwcpMessage,
  PROTOCOL_VERSION,
} from '@awcp/sdk';

// Simple in-memory message router for demo
class MessageRouter {
  private handlers = new Map<string, (msg: AwcpMessage, from: string) => Promise<void>>();

  register(url: string, handler: (msg: AwcpMessage, from: string) => Promise<void>) {
    this.handlers.set(url, handler);
  }

  async send(from: string, to: string, message: AwcpMessage): Promise<void> {
    console.log(`\n📨 ${from} → ${to}: ${message.type}`);
    console.log(`   Delegation: ${message.delegationId.slice(0, 8)}...`);
    
    const handler = this.handlers.get(to);
    if (handler) {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 100));
      await handler(message, from);
    } else {
      console.error(`No handler for ${to}`);
    }
  }
}

const router = new MessageRouter();

// Host configuration
const HOST_URL = 'http://host.local:4000/a2a';
const REMOTE_URL = 'http://remote.local:4001/a2a';

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       AWCP Protocol Demo                   ║');
  console.log('║   Agent Workspace Collaboration Protocol   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Create Host daemon
  const hostDaemon = new HostDaemon({
    admission: {
      maxTotalBytes: 100 * 1024 * 1024,
    },
    export: {
      baseDir: '/tmp/awcp-demo/exports',
    },
    sendMessage: (peerUrl, msg) => router.send(HOST_URL, peerUrl, msg),
    generateCredential: async (delegationId, ttl) => ({
      credential: `demo-key-${delegationId.slice(0, 8)}`,
      endpoint: { host: 'localhost', port: 22, user: 'demo' },
    }),
    revokeCredential: async () => {},
  });

  // Create Remote daemon
  const remoteDaemon = new RemoteDaemon({
    policy: {
      mountRoot: '/tmp/awcp-demo/mounts',
    },
    sandboxProfile: {
      cwdOnly: true,
      allowNetwork: true,
      allowExec: true,
    },
    sendMessage: (peerUrl, msg) => router.send(REMOTE_URL, peerUrl, msg),
    mount: async (params) => {
      console.log(`   🔗 Mounting: ${params.endpoint.host}:${params.exportLocator}`);
      console.log(`      → ${params.mountPoint}`);
      // Skip actual mount in demo
    },
    unmount: async (mountPoint) => {
      console.log(`   🔓 Unmounting: ${mountPoint}`);
    },
    executeTask: async ({ task, mountPoint }) => {
      console.log(`\n   🤖 Executing task...`);
      console.log(`      📁 Workspace: ${mountPoint}`);
      console.log(`      📋 Task: ${task.description}`);
      
      // Simulate work
      await new Promise((r) => setTimeout(r, 500));
      
      return {
        summary: 'Successfully analyzed the codebase. Found 3 files that could be improved.',
        highlights: ['src/index.ts', 'src/utils.ts'],
      };
    },
  });

  // Register message handlers
  router.register(HOST_URL, async (msg, from) => {
    await hostDaemon.handleMessage(msg);
  });

  router.register(REMOTE_URL, async (msg, from) => {
    await remoteDaemon.handleMessage(msg, from);
  });

  // Set up event logging
  hostDaemon.on('delegation:created', (d) => {
    console.log(`\n✅ [Host] Delegation created`);
  });

  hostDaemon.on('delegation:started', (d) => {
    console.log(`\n🚀 [Host] Remote is now working...`);
  });

  hostDaemon.on('delegation:completed', (d) => {
    console.log(`\n🎉 [Host] Delegation completed!`);
    console.log(`   Summary: ${d.result?.summary}`);
    if (d.result?.highlights?.length) {
      console.log(`   Highlights: ${d.result.highlights.join(', ')}`);
    }
  });

  remoteDaemon.on('invitation:received', () => {
    console.log(`\n📥 [Remote] Invitation received, checking policy...`);
  });

  // Start the delegation
  console.log('Starting delegation flow...\n');
  console.log('─'.repeat(50));

  try {
    const delegationId = await hostDaemon.createDelegation({
      peerUrl: REMOTE_URL,
      localDir: '/demo/workspace',
      task: {
        description: 'Review code quality',
        prompt: 'Please review the code and suggest improvements.',
      },
      ttlSeconds: 3600,
      accessMode: 'rw',
    });

    // Wait for completion
    await hostDaemon.waitForResult(delegationId, 10000);
    
    console.log('\n' + '─'.repeat(50));
    console.log('\n✨ Demo completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
  }
}

main().catch(console.error);

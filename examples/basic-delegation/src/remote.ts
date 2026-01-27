/**
 * Basic AWCP Remote Example
 * 
 * This example demonstrates how to create a Remote daemon
 * that can accept workspace delegations from hosts.
 */

import { RemoteDaemon } from '@awcp/sdk';
import { SshfsMountClient } from '@awcp/transport-sshfs';

// In-memory message queue for demo
const messageQueue = new Map<string, any[]>();

// SSHFS mount client
const sshfsClient = new SshfsMountClient({
  tempKeyDir: '/tmp/awcp-demo/client-keys',
  defaultOptions: {
    'cache': 'yes',
    'cache_timeout': '60',
  },
});

// Create Remote daemon
const remoteDaemon = new RemoteDaemon({
  // Local policy settings
  policy: {
    mountRoot: '/tmp/awcp-demo/mounts',
    maxConcurrent: 5,
  },
  
  // Sandbox profile to advertise
  sandboxProfile: {
    cwdOnly: true,
    allowNetwork: true,
    allowExec: true,
  },

  // Message sending (would use A2A in production)
  sendMessage: async (peerUrl, message) => {
    console.log(`[Remote] Sending ${message.type} to ${peerUrl}`);
    const queue = messageQueue.get(peerUrl) ?? [];
    queue.push(message);
    messageQueue.set(peerUrl, queue);
  },

  // Mount handler
  mount: async (params) => {
    console.log(`[Remote] Mounting ${params.endpoint.host}:${params.exportLocator} -> ${params.mountPoint}`);
    await sshfsClient.mount(params);
  },

  // Unmount handler
  unmount: async (mountPoint) => {
    console.log(`[Remote] Unmounting ${mountPoint}`);
    await sshfsClient.unmount(mountPoint);
  },

  // Task executor (this is where the actual agent work happens)
  executeTask: async ({ delegationId, mountPoint, task }) => {
    console.log(`[Remote] Executing task in ${mountPoint}`);
    console.log(`[Remote] Task: ${task.description}`);
    
    // Simulate task execution
    // In a real implementation, this would invoke the agent's tools
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    return {
      summary: 'Task completed successfully. Reviewed 10 files, found 3 issues, fixed 2.',
      highlights: ['src/index.ts', 'src/utils.ts'],
      notes: 'One issue requires manual review due to ambiguous requirements.',
    };
  },
});

// Event handlers
remoteDaemon.on('invitation:received', (invite, peerUrl) => {
  console.log(`[Remote] Received invitation from ${peerUrl}`);
  console.log(`[Remote] Task: ${invite.task.description}`);
});

remoteDaemon.on('task:started', (delegationId, mountPoint) => {
  console.log(`[Remote] Task started: ${delegationId}`);
  console.log(`[Remote] Working in: ${mountPoint}`);
});

remoteDaemon.on('task:completed', (delegationId, summary) => {
  console.log(`[Remote] Task completed: ${delegationId}`);
  console.log(`[Remote] Summary: ${summary}`);
});

remoteDaemon.on('task:failed', (delegationId, error) => {
  console.error(`[Remote] Task failed: ${error.message}`);
});

// Export for use in demo
export { remoteDaemon, messageQueue };

// Main entry point
async function main() {
  console.log('AWCP Remote Daemon Example');
  console.log('==========================');
  
  // Check sshfs availability
  const depCheck = await sshfsClient.checkDependency();
  if (!depCheck.available) {
    console.error('sshfs not available. Please install it first.');
    process.exit(1);
  }
  console.log(`sshfs version: ${depCheck.version}`);
  
  console.log('Remote daemon ready, waiting for invitations...');
  
  // Keep running
  await new Promise(() => {});
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

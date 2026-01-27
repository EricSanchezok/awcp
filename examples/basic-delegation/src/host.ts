/**
 * Basic AWCP Host Example
 * 
 * This example demonstrates how to create a Host daemon
 * that can delegate workspace access to remote agents.
 */

import { HostDaemon } from '@awcp/sdk';
import { CredentialManager } from '@awcp/transport-sshfs';

// In-memory message queue for demo (replace with real A2A in production)
const messageQueue = new Map<string, any[]>();

// Credential manager for SSH keys
const credentialManager = new CredentialManager({
  sshHost: 'localhost',
  sshPort: 22,
  sshUser: process.env['USER'],
});

// Create Host daemon
const hostDaemon = new HostDaemon({
  // Admission control settings
  admission: {
    maxTotalBytes: 50 * 1024 * 1024, // 50MB
    maxFileCount: 5000,
  },
  
  // Export view settings
  export: {
    baseDir: '/tmp/awcp-demo/exports',
    strategy: 'symlink',
  },
  
  // Default TTL
  defaultTtlSeconds: 3600, // 1 hour

  // Message sending (would use A2A in production)
  sendMessage: async (peerUrl, message) => {
    console.log(`[Host] Sending ${message.type} to ${peerUrl}`);
    const queue = messageQueue.get(peerUrl) ?? [];
    queue.push(message);
    messageQueue.set(peerUrl, queue);
  },

  // Credential generation
  generateCredential: async (delegationId, ttlSeconds) => {
    return credentialManager.generateCredential(delegationId, ttlSeconds);
  },

  // Credential revocation
  revokeCredential: async (delegationId) => {
    await credentialManager.revokeCredential(delegationId);
  },
});

// Event handlers
hostDaemon.on('delegation:created', (delegation) => {
  console.log(`[Host] Delegation created: ${delegation.id}`);
});

hostDaemon.on('delegation:started', (delegation) => {
  console.log(`[Host] Delegation started: ${delegation.id}`);
});

hostDaemon.on('delegation:completed', (delegation) => {
  console.log(`[Host] Delegation completed: ${delegation.id}`);
  console.log(`[Host] Result: ${delegation.result?.summary}`);
});

hostDaemon.on('delegation:error', (delegation, error) => {
  console.error(`[Host] Delegation error: ${error.message}`);
});

// Export for use in demo
export { hostDaemon, messageQueue };

// Main entry point
async function main() {
  console.log('AWCP Host Daemon Example');
  console.log('========================');
  
  // Example: Create a delegation
  const delegationId = await hostDaemon.createDelegation({
    peerUrl: 'http://localhost:4001/a2a',
    localDir: process.cwd(),
    task: {
      description: 'Review and improve code quality',
      prompt: `Please review the code in this workspace and:
1. Identify any code quality issues
2. Suggest improvements
3. Fix any obvious bugs

Do NOT modify any configuration files.`,
    },
    ttlSeconds: 1800, // 30 minutes
    accessMode: 'rw',
  });

  console.log(`Created delegation: ${delegationId}`);
  
  // Wait for result
  const result = await hostDaemon.waitForResult(delegationId, 60000);
  console.log('Final state:', result.state);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

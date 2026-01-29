import { unlink, mkdir, readFile, writeFile, appendFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

/**
 * SSH Credential Manager configuration
 */
export interface CredentialManagerConfig {
  /** Directory to store temporary keys (default: ~/.awcp/keys) */
  keyDir?: string;
  /** SSH server port (default: 22) */
  sshPort?: number;
  /** SSH server host (default: localhost) */
  sshHost?: string;
  /** SSH user for connections */
  sshUser?: string;
  /** Path to authorized_keys file (default: ~/.ssh/authorized_keys) */
  authorizedKeysPath?: string;
}

/**
 * Generated credential
 */
export interface GeneratedCredential {
  /** The private key content */
  privateKey: string;
  /** The public key content */
  publicKey: string;
  /** Path to the private key file */
  privateKeyPath: string;
  /** Path to the public key file */
  publicKeyPath: string;
  /** Delegation ID for tracking */
  delegationId: string;
}

const DEFAULT_KEY_DIR = join(homedir(), '.awcp', 'keys');

/**
 * Marker prefix for AWCP-managed keys in authorized_keys
 */
const AWCP_KEY_COMMENT_PREFIX = 'awcp-temp-key-';

/**
 * SSH Credential Manager
 * 
 * Manages temporary SSH keys for AWCP delegations.
 * 
 * TODO [Security]: Consider SSH certificates with built-in expiry for production.
 */
export class CredentialManager {
  private config: CredentialManagerConfig;
  private activeCredentials = new Map<string, GeneratedCredential>();

  constructor(config?: CredentialManagerConfig) {
    this.config = config ?? {};
  }

  /**
   * Get the path to authorized_keys file
   */
  private getAuthorizedKeysPath(): string {
    return this.config.authorizedKeysPath ?? join(homedir(), '.ssh', 'authorized_keys');
  }

  /**
   * Generate a temporary SSH key pair for a delegation
   */
  async generateCredential(
    delegationId: string,
    _ttlSeconds: number,
  ): Promise<{
    credential: string;
    endpoint: { host: string; port: number; user: string };
  }> {
    const keyDir = this.config.keyDir ?? DEFAULT_KEY_DIR;
    await mkdir(keyDir, { recursive: true, mode: 0o700 });

    const privateKeyPath = join(keyDir, `${delegationId}`);
    const publicKeyPath = join(keyDir, `${delegationId}.pub`);

    // Generate key pair using ssh-keygen with AWCP marker comment
    const keyComment = `${AWCP_KEY_COMMENT_PREFIX}${delegationId}`;
    await this.execSshKeygen(privateKeyPath, keyComment);

    // Read the generated keys
    const privateKey = await readFile(privateKeyPath, 'utf-8');
    const publicKey = await readFile(publicKeyPath, 'utf-8');

    const credential: GeneratedCredential = {
      privateKey,
      publicKey,
      privateKeyPath,
      publicKeyPath,
      delegationId,
    };

    this.activeCredentials.set(delegationId, credential);

    // Add public key to authorized_keys
    await this.addToAuthorizedKeys(publicKey);

    return {
      credential: privateKey,
      endpoint: {
        host: this.config.sshHost ?? 'localhost',
        port: this.config.sshPort ?? 22,
        user: this.config.sshUser ?? process.env['USER'] ?? 'awcp',
      },
    };
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(delegationId: string): Promise<void> {
    const credential = this.activeCredentials.get(delegationId);
    if (!credential) {
      return;
    }

    // Remove from authorized_keys first
    await this.removeFromAuthorizedKeys(delegationId);

    // Remove key files
    try {
      await unlink(credential.privateKeyPath);
    } catch {
      // Ignore errors if file doesn't exist
    }
    try {
      await unlink(credential.publicKeyPath);
    } catch {
      // Ignore errors if file doesn't exist
    }

    this.activeCredentials.delete(delegationId);
  }

  /**
   * Get credential info for a delegation
   */
  getCredential(delegationId: string): GeneratedCredential | undefined {
    return this.activeCredentials.get(delegationId);
  }

  /**
   * Revoke all credentials
   */
  async revokeAll(): Promise<void> {
    for (const delegationId of this.activeCredentials.keys()) {
      await this.revokeCredential(delegationId);
    }
  }

  /**
   * Clean up stale AWCP keys from authorized_keys (call on startup)
   */
  async cleanupStaleKeys(): Promise<number> {
    const authorizedKeysPath = this.getAuthorizedKeysPath();
    
    try {
      const content = await readFile(authorizedKeysPath, 'utf-8');
      const lines = content.split('\n');
      
      const cleanedLines = lines.filter(line => {
        // Keep lines that don't have AWCP marker
        return !line.includes(AWCP_KEY_COMMENT_PREFIX);
      });

      const removedCount = lines.length - cleanedLines.length;
      
      if (removedCount > 0) {
        await writeFile(authorizedKeysPath, cleanedLines.join('\n'));
        console.log(`[CredentialManager] Cleaned up ${removedCount} stale AWCP keys from authorized_keys`);
      }

      return removedCount;
    } catch {
      // File doesn't exist or can't be read, nothing to clean
      return 0;
    }
  }

  /**
   * Clean up stale key files from key directory (call on startup)
   */
  async cleanupStaleKeyFiles(): Promise<number> {
    const keyDir = this.config.keyDir ?? DEFAULT_KEY_DIR;
    
    try {
      const files = await readdir(keyDir);
      let removedCount = 0;

      for (const file of files) {
        // Skip files that are currently active
        const delegationId = file.replace(/\.pub$/, '');
        if (this.activeCredentials.has(delegationId)) {
          continue;
        }

        // Remove stale key files
        try {
          await unlink(join(keyDir, file));
          removedCount++;
        } catch {
          // Ignore errors
        }
      }

      if (removedCount > 0) {
        console.log(`[CredentialManager] Cleaned up ${removedCount} stale key files`);
      }

      return removedCount;
    } catch {
      // Directory doesn't exist, nothing to clean
      return 0;
    }
  }

  /**
   * Add a public key to authorized_keys
   */
  private async addToAuthorizedKeys(publicKey: string): Promise<void> {
    const authorizedKeysPath = this.getAuthorizedKeysPath();
    
    // Ensure .ssh directory exists
    const sshDir = join(homedir(), '.ssh');
    await mkdir(sshDir, { recursive: true, mode: 0o700 });

    // Ensure the key ends with newline
    const keyLine = publicKey.trim() + '\n';

    // Append to authorized_keys
    await appendFile(authorizedKeysPath, keyLine, { mode: 0o600 });
  }

  /**
   * Remove a public key from authorized_keys by delegation ID
   */
  private async removeFromAuthorizedKeys(delegationId: string): Promise<void> {
    const authorizedKeysPath = this.getAuthorizedKeysPath();
    const keyMarker = `${AWCP_KEY_COMMENT_PREFIX}${delegationId}`;

    try {
      const content = await readFile(authorizedKeysPath, 'utf-8');
      const lines = content.split('\n');
      
      // Filter out lines containing this delegation's key marker
      const filteredLines = lines.filter(line => !line.includes(keyMarker));
      
      // Write back
      await writeFile(authorizedKeysPath, filteredLines.join('\n'), { mode: 0o600 });
    } catch {
      // File doesn't exist or can't be read, nothing to remove
    }
  }

  /**
   * Execute ssh-keygen to generate a key pair
   */
  private execSshKeygen(keyPath: string, comment: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ssh-keygen', [
        '-t', 'ed25519',
        '-f', keyPath,
        '-N', '', // No passphrase
        '-C', comment,
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ssh-keygen failed: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }
}

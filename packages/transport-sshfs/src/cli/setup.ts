#!/usr/bin/env node
/**
 * AWCP SSHFS Transport Setup CLI
 *
 * Configures SSH certificate authentication for AWCP.
 *
 * Usage:
 *   npx @awcp/transport-sshfs setup          # Check and guide
 *   npx @awcp/transport-sshfs setup --auto   # Auto-configure (needs sudo)
 *   npx @awcp/transport-sshfs setup --check  # Check only
 */

import { spawn, execSync } from 'node:child_process';
import { access, mkdir, readFile, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import * as net from 'node:net';

const CA_KEY_PATH = join(homedir(), '.awcp', 'ca');
const SSHD_CONFIG_PATH = '/etc/ssh/sshd_config';

interface CheckResult {
  name: string;
  status: 'ok' | 'missing' | 'error';
  message: string;
  hint?: string;
}

/**
 * Print colored output
 */
function print(message: string): void {
  console.log(message);
}

function printStatus(name: string, status: 'ok' | 'missing' | 'error', message: string): void {
  const icon = status === 'ok' ? '✓' : status === 'missing' ? '✗' : '!';
  const color = status === 'ok' ? '\x1b[32m' : status === 'missing' ? '\x1b[31m' : '\x1b[33m';
  console.log(`  ${color}[${icon}]\x1b[0m ${name.padEnd(20)} ${message}`);
}

/**
 * Check if a command exists
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if sshd is running
 */
/**
 * Check if sshd is running by trying to connect to port 22
 */
async function isSshdRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(22, 'localhost');
  });
}

/**
 * Check if sshd_config has TrustedUserCAKeys configured
 */
async function isSshdConfigured(): Promise<boolean> {
  try {
    const content = await readFile(SSHD_CONFIG_PATH, 'utf-8');
    const caKeyPub = `${CA_KEY_PATH}.pub`;
    return content.includes(`TrustedUserCAKeys`) && content.includes(caKeyPub);
  } catch {
    return false;
  }
}

/**
 * Check if CA key exists
 */
async function caKeyExists(): Promise<boolean> {
  try {
    await access(CA_KEY_PATH, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate CA key pair
 */
async function generateCaKey(): Promise<void> {
  const caDir = join(CA_KEY_PATH, '..');
  await mkdir(caDir, { recursive: true, mode: 0o700 });

  return new Promise((resolve, reject) => {
    const proc = spawn('ssh-keygen', [
      '-t', 'ed25519',
      '-f', CA_KEY_PATH,
      '-N', '',
      '-C', 'awcp-ca',
    ], { stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ssh-keygen failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Configure sshd (requires sudo)
 */
async function configureSshd(): Promise<void> {
  const caKeyPub = `${CA_KEY_PATH}.pub`;
  
  print('\n  Configuring sshd (requires sudo)...');
  
  // Add TrustedUserCAKeys to sshd_config
  execSync(`echo "TrustedUserCAKeys ${caKeyPub}" | sudo tee -a ${SSHD_CONFIG_PATH}`, {
    stdio: 'inherit',
  });

  // Restart sshd
  if (platform() === 'darwin') {
    execSync('sudo launchctl stop com.openssh.sshd', { stdio: 'inherit' });
  } else {
    execSync('sudo systemctl restart sshd || sudo systemctl restart ssh', { stdio: 'inherit' });
  }
}

/**
 * Run all checks
 */
async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check ssh-keygen
  const hasSshKeygen = await commandExists('ssh-keygen');
  results.push({
    name: 'ssh-keygen',
    status: hasSshKeygen ? 'ok' : 'missing',
    message: hasSshKeygen ? 'found' : 'not found',
    hint: 'Install OpenSSH client',
  });

  // Check sshfs
  const hasSshfs = await commandExists('sshfs');
  results.push({
    name: 'sshfs',
    status: hasSshfs ? 'ok' : 'missing',
    message: hasSshfs ? 'found' : 'not found',
    hint: platform() === 'darwin'
      ? 'Install: brew install macfuse && brew install sshfs'
      : 'Install: sudo apt install sshfs',
  });

  // Check sshd
  const sshdRunning = await isSshdRunning();
  results.push({
    name: 'sshd',
    status: sshdRunning ? 'ok' : 'missing',
    message: sshdRunning ? 'running' : 'not running',
    hint: platform() === 'darwin'
      ? 'Enable: System Settings → General → Sharing → Remote Login'
      : 'Install & start: sudo apt install openssh-server && sudo systemctl start sshd',
  });

  // Check CA key
  const hasCaKey = await caKeyExists();
  results.push({
    name: 'CA key',
    status: hasCaKey ? 'ok' : 'missing',
    message: hasCaKey ? `exists at ${CA_KEY_PATH}` : 'not found',
    hint: 'Will be auto-generated',
  });

  // Check sshd config (only if CA key exists)
  if (hasCaKey) {
    const sshdConfigured = await isSshdConfigured();
    results.push({
      name: 'sshd TrustedUserCAKeys',
      status: sshdConfigured ? 'ok' : 'missing',
      message: sshdConfigured ? 'configured' : 'not configured',
      hint: `Add to ${SSHD_CONFIG_PATH}: TrustedUserCAKeys ${CA_KEY_PATH}.pub`,
    });
  }

  return results;
}

/**
 * Print setup instructions
 */
function printInstructions(results: CheckResult[]): void {
  const missing = results.filter(r => r.status === 'missing');
  
  if (missing.length === 0) {
    print('\n  \x1b[32m✓ All checks passed! AWCP is ready to use.\x1b[0m\n');
    return;
  }

  print('\n  \x1b[33mSetup required:\x1b[0m\n');

  for (const result of missing) {
    if (result.hint) {
      print(`  • ${result.name}: ${result.hint}`);
    }
  }

  // Print auto command hint
  const needsSshdConfig = missing.some(r => r.name === 'sshd TrustedUserCAKeys');
  const needsCaKey = missing.some(r => r.name === 'CA key');
  
  if (needsCaKey || needsSshdConfig) {
    print('\n  Or run with --auto to configure automatically:');
    print('    npx @awcp/transport-sshfs setup --auto\n');
  }
}

/**
 * Main setup function
 */
async function setup(options: { auto?: boolean; check?: boolean }): Promise<void> {
  print('');
  print('╔════════════════════════════════════════════════════════════╗');
  print('║         AWCP SSHFS Transport Setup                         ║');
  print('╚════════════════════════════════════════════════════════════╝');
  print('');
  print('  Checking dependencies...');
  print('');

  const results = await runChecks();

  for (const result of results) {
    printStatus(result.name, result.status, result.message);
  }

  if (options.check) {
    const allOk = results.every(r => r.status === 'ok');
    process.exit(allOk ? 0 : 1);
  }

  if (options.auto) {
    // Auto-configure
    const needsCaKey = results.some(r => r.name === 'CA key' && r.status === 'missing');
    const needsSshdConfig = results.some(r => r.name === 'sshd TrustedUserCAKeys' && r.status === 'missing');

    if (needsCaKey) {
      print('\n  Generating CA key pair...');
      await generateCaKey();
      printStatus('CA key', 'ok', `generated at ${CA_KEY_PATH}`);
    }

    if (needsSshdConfig || needsCaKey) {
      // Re-check if sshd config is needed after CA key generation
      const sshdConfigured = await isSshdConfigured();
      if (!sshdConfigured) {
        await configureSshd();
        printStatus('sshd TrustedUserCAKeys', 'ok', 'configured');
      }
    }

    print('\n  \x1b[32m✓ Setup complete! AWCP is ready to use.\x1b[0m\n');
  } else {
    printInstructions(results);
  }
}

/**
 * Parse CLI arguments and run
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Handle help
  if (args.includes('--help') || args.includes('-h')) {
    print(`
AWCP SSHFS Transport Setup

Usage:
  npx @awcp/transport-sshfs setup [options]

Options:
  --auto    Auto-configure everything (requires sudo for sshd config)
  --check   Check only, don't print setup instructions
  --help    Show this help message

Examples:
  npx @awcp/transport-sshfs setup          # Check and show instructions
  npx @awcp/transport-sshfs setup --auto   # Auto-configure
`);
    process.exit(0);
  }

  const options = {
    auto: args.includes('--auto'),
    check: args.includes('--check'),
  };

  try {
    await setup(options);
  } catch (error) {
    console.error('\n  \x1b[31mError:\x1b[0m', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

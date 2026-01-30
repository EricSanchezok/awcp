#!/usr/bin/env npx tsx
/**
 * Version bump script
 * Usage: npx tsx scripts/version.ts [patch|minor|major]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES = [
  'packages/core',
  'packages/transport-sshfs',
  'packages/sdk',
  'packages/mcp',
];

type BumpType = 'patch' | 'minor' | 'major';

function bumpVersion(version: string, type: BumpType): string {
  const parts = version.split('.').map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function main() {
  const bumpType = process.argv[2] as BumpType;
  
  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    console.error('Usage: npx tsx scripts/version.ts [patch|minor|major]');
    process.exit(1);
  }

  // Get current version from core package
  const corePackagePath = join(process.cwd(), 'packages/core/package.json');
  const corePackage = JSON.parse(readFileSync(corePackagePath, 'utf-8'));
  const currentVersion = corePackage.version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`Bumping version: ${currentVersion} → ${newVersion} (${bumpType})`);

  // Update all packages
  for (const pkgDir of PACKAGES) {
    const pkgPath = join(process.cwd(), pkgDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    pkg.version = newVersion;
    
    // Also update internal dependencies
    if (pkg.dependencies) {
      for (const dep of Object.keys(pkg.dependencies)) {
        if (dep.startsWith('@awcp/')) {
          pkg.dependencies[dep] = `^${newVersion}`;
        }
      }
    }
    
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  Updated: ${pkgDir}/package.json`);
  }

  console.log(`\n✓ All packages updated to v${newVersion}`);
}

main();

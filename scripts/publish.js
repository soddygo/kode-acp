#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    log(`Running: ${command}`, 'cyan');
    execSync(command, { stdio: 'inherit', ...options });
    log(`✓ Success: ${command}`, 'green');
  } catch (error) {
    log(`✗ Failed: ${command}`, 'red');
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function bumpVersion(type = 'patch') {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

  const currentVersion = packageJson.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }

  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  log(`Version bumped from ${currentVersion} to ${newVersion}`, 'green');
  return newVersion;
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain').toString();
    if (status.trim()) {
      throw new Error('Working directory is not clean');
    }
    log('✓ Git working directory is clean', 'green');
  } catch (error) {
    log(`✗ Git check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function checkBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    if (branch !== 'main' && branch !== 'master') {
      throw new Error(`Not on main/master branch (current: ${branch})`);
    }
    log(`✓ On correct branch: ${branch}`, 'green');
  } catch (error) {
    log(`✗ Branch check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'patch';
  const dryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');

  log('🚀 Starting publish process...', 'blue');

  // Check prerequisites
  checkGitStatus();
  checkBranch();

  // Version bump
  const version = bumpVersion(type);
  log(`📦 Version: ${version}`, 'yellow');

  // Build and test
  runCommand('npm run build');

  if (!skipTests) {
    runCommand('npm run check');
  }

  // Git operations
  runCommand(`git add package.json`);
  runCommand(`git commit -m "Release v${version}"`);
  runCommand(`git tag v${version}`);

  // Push to remote
  if (!dryRun) {
    runCommand('git push');
    runCommand('git push --tags');
  }

  // Publish to npm
  if (!dryRun) {
    runCommand('npm publish');
  } else {
    runCommand('npm run publish:dry-run');
  }

  // Publish to Deno
  if (!dryRun) {
    try {
      runCommand('deno publish --allow-scratch');
    } catch (error) {
      log(`⚠️  Deno publish failed: ${error.message}`, 'yellow');
      log('You may need to manually publish to Deno', 'yellow');
    }
  }

  log('🎉 Publish process completed successfully!', 'green');
  if (dryRun) {
    log('(Dry run - no actual publishing)', 'yellow');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`❌ Publish failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { main };
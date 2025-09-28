#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
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
    const output = execSync(command, { ...options, encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    return null;
  }
}

function checkNpmLogin() {
  const username = runCommand('npm whoami');
  if (!username) {
    log('❌ Not logged in to npm', 'red');
    log('Run: npm login', 'yellow');
    return false;
  }
  log(`✓ Logged in to npm as: ${username}`, 'green');
  return true;
}

function checkPackageJson() {
  const packagePath = join(process.cwd(), 'package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

    const required = ['name', 'version', 'description', 'main', 'bin'];
    const missing = required.filter(field => !packageJson[field]);

    if (missing.length > 0) {
      log(`❌ Missing required fields in package.json: ${missing.join(', ')}`, 'red');
      return false;
    }

    log(`✓ package.json is valid`, 'green');
    log(`  - Name: ${packageJson.name}`, 'cyan');
    log(`  - Version: ${packageJson.version}`, 'cyan');
    log(`  - Main: ${packageJson.main}`, 'cyan');
    log(`  - Bin: ${JSON.stringify(packageJson.bin)}`, 'cyan');
    return true;
  } catch (error) {
    log(`❌ Failed to read package.json: ${error.message}`, 'red');
    return false;
  }
}

function checkGitStatus() {
  const status = runCommand('git status --porcelain');
  if (status && status.trim()) {
    log('❌ Working directory is not clean', 'red');
    log('Uncommitted changes:', 'yellow');
    log(status, 'yellow');
    return false;
  }
  log('✓ Git working directory is clean', 'green');
  return true;
}

function checkGitRemote() {
  const remote = runCommand('git remote get-url origin');
  if (!remote) {
    log('❌ No git remote origin found', 'red');
    return false;
  }
  log(`✓ Git remote: ${remote}`, 'green');
  return true;
}

function checkBuild() {
  const distExists = runCommand('test -d dist && echo "exists"');
  if (!distExists) {
    log('❌ dist directory does not exist', 'red');
    log('Run: npm run build', 'yellow');
    return false;
  }
  log('✓ dist directory exists', 'green');
  return true;
}

function checkDependencies() {
  const packageLock = runCommand('test -f package-lock.json && echo "exists"');
  if (!packageLock) {
    log('⚠️  package-lock.json not found', 'yellow');
    log('Consider running: npm install', 'yellow');
  } else {
    log('✓ package-lock.json exists', 'green');
  }

  const nodeModules = runCommand('test -d node_modules && echo "exists"');
  if (!nodeModules) {
    log('❌ node_modules directory does not exist', 'red');
    log('Run: npm install', 'yellow');
    return false;
  }
  log('✓ node_modules directory exists', 'green');
  return true;
}

function checkNameAvailability() {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const packageName = packageJson.name;

  try {
    const info = JSON.parse(runCommand(`npm info ${packageName} --json`));
    log(`⚠️  Package "${packageName}" is already published`, 'yellow');
    log(`  - Latest version: ${info.version}`, 'cyan');
    log(`  - Your version: ${packageJson.version}`, 'cyan');
    return true; // Not an error, just a warning
  } catch (error) {
    log(`✓ Package "${packageName}" is available for publishing`, 'green');
    return true;
  }
}

async function main() {
  log('🔍 Checking publish prerequisites...', 'blue');
  log('');

  const checks = [
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Git Status', fn: checkGitStatus },
    { name: 'Git Remote', fn: checkGitRemote },
    { name: 'package.json', fn: checkPackageJson },
    { name: 'Build', fn: checkBuild },
    { name: 'Name Availability', fn: checkNameAvailability },
    { name: 'npm Login', fn: checkNpmLogin },
  ];

  let allPassed = true;
  for (const check of checks) {
    const result = check.fn();
    if (!result) {
      allPassed = false;
    }
    log('');
  }

  if (allPassed) {
    log('🎉 All checks passed! Ready to publish.', 'green');
    log('');
    log('To publish:', 'cyan');
    log('  npm run publish:dry-run    # Test publishing', 'yellow');
    log('  npm publish               # Actually publish', 'yellow');
    log('  node scripts/publish.js  # Automated publishing', 'yellow');
  } else {
    log('❌ Some checks failed. Please fix the issues above.', 'red');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`❌ Check failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { main };
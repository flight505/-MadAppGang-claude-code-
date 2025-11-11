#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  // Check if bun is installed
  execSync('bun --version', { stdio: 'ignore' });
  console.log('\x1b[32m✓ Bun runtime detected\x1b[0m');
  console.log('\x1b[32m✓ Claudish installed successfully!\x1b[0m');
  console.log('');
  console.log('\x1b[1mUsage:\x1b[0m');
  console.log('  claudish --model x-ai/grok-code-fast-1 "your prompt"');
  console.log('');
} catch (error) {
  console.error('\x1b[33m⚠ WARNING: Bun runtime not found!\x1b[0m');
  console.error('');
  console.error('Claudish requires Bun for optimal performance (10x faster than Node.js).');
  console.error('');
  console.error('\x1b[1mInstall Bun:\x1b[0m');
  console.error('  curl -fsSL https://bun.sh/install | bash');
  console.error('');
  console.error('Or visit: https://bun.sh');
  console.error('');
  process.exit(0); // Don't fail installation, just warn
}

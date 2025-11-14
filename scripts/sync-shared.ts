#!/usr/bin/env bun

/**
 * Sync Shared Resources to Plugins
 *
 * This script copies shared resources (like recommended-models.md) from the
 * central `shared/` directory to all plugin directories.
 *
 * Usage:
 *   bun run sync-shared
 *
 * What it does:
 * 1. Reads all files from shared/ directory
 * 2. Copies each file to all plugin directories
 * 3. Creates directories if they don't exist
 * 4. Reports what was synced and any errors
 */

import { readdir, copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Configuration
const SHARED_DIR = resolve(__dirname, '../shared');
const PLUGINS_DIR = resolve(__dirname, '../plugins');
const PLUGIN_NAMES = ['frontend', 'bun', 'code-analysis'];

interface SyncResult {
  file: string;
  destinations: string[];
  errors: Array<{ plugin: string; error: string }>;
}

async function ensureDirectoryExists(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function syncFileToPlugins(fileName: string): Promise<SyncResult> {
  const result: SyncResult = {
    file: fileName,
    destinations: [],
    errors: [],
  };

  const sourcePath = join(SHARED_DIR, fileName);

  for (const pluginName of PLUGIN_NAMES) {
    const pluginDir = join(PLUGINS_DIR, pluginName);
    const destPath = join(pluginDir, fileName);

    try {
      // Ensure plugin directory exists
      await ensureDirectoryExists(pluginDir);

      // Copy file
      await copyFile(sourcePath, destPath);

      result.destinations.push(destPath);
      console.log(`  ✓ ${pluginName}/${fileName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({ plugin: pluginName, error: errorMessage });
      console.error(`  ✗ ${pluginName}/${fileName} - ${errorMessage}`);
    }
  }

  return result;
}

async function syncAllSharedFiles(): Promise<void> {
  console.log('🔄 Syncing shared resources to plugins...\n');

  // Check if shared directory exists
  if (!existsSync(SHARED_DIR)) {
    console.error(`❌ Shared directory not found: ${SHARED_DIR}`);
    process.exit(1);
  }

  // Read all files from shared directory
  const files = await readdir(SHARED_DIR, { withFileTypes: true });
  const sharedFiles = files
    .filter((dirent) => dirent.isFile() && !dirent.name.startsWith('.'))
    .map((dirent) => dirent.name);

  if (sharedFiles.length === 0) {
    console.log('⚠️  No files found in shared/ directory');
    return;
  }

  console.log(`📦 Found ${sharedFiles.length} file(s) to sync:\n`);

  // Sync each file
  const results: SyncResult[] = [];
  for (const fileName of sharedFiles) {
    console.log(`Syncing ${fileName}:`);
    const result = await syncFileToPlugins(fileName);
    results.push(result);
    console.log();
  }

  // Summary
  console.log('━'.repeat(60));
  console.log('Summary:\n');

  const totalSuccesses = results.reduce((sum, r) => sum + r.destinations.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`✓ Successfully synced: ${totalSuccesses} file(s)`);
  if (totalErrors > 0) {
    console.log(`✗ Failed: ${totalErrors} file(s)`);
  }

  // List all synced files
  console.log('\nSynced files:');
  for (const result of results) {
    console.log(`  ${result.file} → ${result.destinations.length} plugin(s)`);
  }

  if (totalErrors > 0) {
    console.log('\n⚠️  Some files failed to sync. Check errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All shared resources synced successfully!');
  }
}

// Run the sync
syncAllSharedFiles().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

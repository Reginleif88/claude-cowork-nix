#!/usr/bin/env node
/**
 * Patch 00: Install Native Module Stub (for Claude Desktop 1.1.2998)
 *
 * Installs enhanced-claude-native-stub.js as @ant/claude-native.
 * This replaces the macOS-only native module with one that uses Electron APIs.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const SOURCE_ROOT = process.argv[3] || path.join(__dirname, '../..');
const SOURCE_STUB = path.join(SOURCE_ROOT, 'modules/enhanced-claude-native-stub.js');

console.log('=== Patch 00: Native Module Stub (2998) ===\n');

// Install as @ant/claude-native
const nativeModDir = path.join(EXTRACTED_DIR, 'node_modules/@ant/claude-native');
fs.mkdirSync(nativeModDir, { recursive: true });
fs.copyFileSync(SOURCE_STUB, path.join(nativeModDir, 'index.js'));
fs.writeFileSync(
  path.join(nativeModDir, 'package.json'),
  JSON.stringify({
    name: '@ant/claude-native',
    version: '1.0.0-linux-stub',
    main: 'index.js',
  }, null, 2)
);
console.log('  Native module stub installed\n');
console.log('Patch 00 applied\n');

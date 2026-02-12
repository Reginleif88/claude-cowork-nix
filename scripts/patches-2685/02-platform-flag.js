#!/usr/bin/env node
/**
 * Patch 02: Platform Flag (for Claude Desktop 1.1.2685)
 *
 * Makes `Hi` (Windows platform flag) also true on Linux.
 * This routes Linux through the TypeScript VM client instead of
 * the macOS-only @ant/claude-swift path. The TypeScript VM client uses
 * IPC sockets which is more Linux-friendly.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 02: Platform Flag (2685) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.02-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch Hi to include Linux
const original = 'Hi=process.platform==="win32"';
const replacement = 'Hi=process.platform==="win32"||process.platform==="linux"';

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched Hi flag to include Linux\n');
} else {
  console.log('  WARNING: Hi flag pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 02 applied\n');

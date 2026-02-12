#!/usr/bin/env node
/**
 * Patch 04: Skip Bundle Download (for Claude Desktop 1.1.2685)
 *
 * Patches Qke() to skip macOS VM bundle download on Linux.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 04: Skip Bundle Download (2685) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.04-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch Qke() to skip download on Linux
const original = 'async function Qke(t,e){return Xp?';
const replacement = `async function Qke(t,e){if(process.platform==="linux"&&global.__linuxCowork){console.log("[Cowork Linux] Skipping bundle download");return!1}return Xp?`;

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched Qke() to skip download on Linux\n');
} else {
  console.log('  WARNING: Qke() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 04 applied\n');

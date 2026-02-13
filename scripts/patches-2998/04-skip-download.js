#!/usr/bin/env node
/**
 * Patch 04: Skip Bundle Download (for Claude Desktop 1.1.2998)
 *
 * Patches gTe() to skip macOS VM bundle download on Linux.
 *
 * v2685: async function Qke(t,e){return Xp?
 * v2998: async function gTe(t,e){return om?
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 04: Skip Bundle Download (2998) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.04-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch gTe() to skip download on Linux
const original = 'async function gTe(t,e){return om?';
const replacement = `async function gTe(t,e){if(process.platform==="linux"&&global.__linuxCowork){console.log("[Cowork Linux] Skipping bundle download");return!1}return om?`;

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched gTe() to skip download on Linux\n');
} else {
  console.log('  WARNING: gTe() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 04 applied\n');

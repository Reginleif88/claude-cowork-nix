#!/usr/bin/env node
/**
 * Patch 04: Skip Bundle Download (for Claude Desktop 1.1.3189)
 *
 * Patches zTe() to skip macOS VM bundle download on Linux.
 *
 * v2685: async function Qke(t,e){return Xp?
 * v2998: async function gTe(t,e){return om?
 * v3189: async function zTe(t,e){const{yukonSilver:r}=Df();return r&&r.status!=="supported"?!1:vm?
 *
 * Note: v3189 added a yukonSilver feature flag check before the download guard.
 * Our Linux check goes before both.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 04: Skip Bundle Download (3189) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.04-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch zTe() to skip download on Linux
const original = 'async function zTe(t,e){const{yukonSilver:r}=Df();return r&&r.status!=="supported"?!1:vm?';
const replacement = `async function zTe(t,e){if(process.platform==="linux"&&global.__linuxCowork){console.log("[Cowork Linux] Skipping bundle download");return!1}const{yukonSilver:r}=Df();return r&&r.status!=="supported"?!1:vm?`;

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched zTe() to skip download on Linux\n');
} else {
  console.log('  WARNING: zTe() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 04 applied\n');

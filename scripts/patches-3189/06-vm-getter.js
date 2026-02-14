#!/usr/bin/env node
/**
 * Patch 06: VM Getter Override (for Claude Desktop 1.1.3189)
 *
 * Patches Ei() to return our Linux VM instance.
 * Also patches aAe() to not short-circuit on non-darwin.
 *
 * v2685: Ii(), B1e(), F1e()
 * v2998: _i(), Oxe(), Rxe()
 * v3189: Ei(), aAe(), iAe()
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 06: VM Getter Override (3189) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.06-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch 6a: Ei() - return our VM instance on Linux
const originalEi = 'async function Ei(){const t=await iAe();return(t==null?void 0:t.vm)??null}';
const replacementEi = `async function Ei(){if(process.platform==="linux"&&global.__linuxCowork&&global.__linuxCowork.vmInstance){console.log("[Cowork Linux] Ei() returning Linux VM");return global.__linuxCowork.vmInstance}const t=await iAe();return(t==null?void 0:t.vm)??null}`;

if (indexContent.includes(originalEi)) {
  indexContent = indexContent.replace(originalEi, replacementEi);
  console.log('  Patched Ei() for Linux VM\n');
} else {
  console.log('  WARNING: Ei() pattern not found\n');
}

// Patch 6b: aAe() - don't return null on Linux
const originalAAe = 'async function aAe(){return process.platform!=="darwin"?null:await iAe()}';
const replacementAAe = 'async function aAe(){return process.platform!=="darwin"&&process.platform!=="linux"?null:await iAe()}';

if (indexContent.includes(originalAAe)) {
  indexContent = indexContent.replace(originalAAe, replacementAAe);
  console.log('  Patched aAe() for Linux\n');
} else {
  console.log('  WARNING: aAe() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 06 applied\n');

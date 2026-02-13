#!/usr/bin/env node
/**
 * Patch 06: VM Getter Override (for Claude Desktop 1.1.2998)
 *
 * Patches _i() to return our Linux VM instance.
 * Also patches Oxe() to not short-circuit on non-darwin.
 *
 * v2685: Ii(), B1e(), F1e()
 * v2998: _i(), Oxe(), Rxe()
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 06: VM Getter Override (2998) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.06-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch 6a: _i() - return our VM instance on Linux
const originalIi = 'async function _i(){const t=await Rxe();return(t==null?void 0:t.vm)??null}';
const replacementIi = `async function _i(){if(process.platform==="linux"&&global.__linuxCowork&&global.__linuxCowork.vmInstance){console.log("[Cowork Linux] _i() returning Linux VM");return global.__linuxCowork.vmInstance}const t=await Rxe();return(t==null?void 0:t.vm)??null}`;

if (indexContent.includes(originalIi)) {
  indexContent = indexContent.replace(originalIi, replacementIi);
  console.log('  Patched _i() for Linux VM\n');
} else {
  console.log('  WARNING: _i() pattern not found\n');
}

// Patch 6b: Oxe() - don't return null on Linux
const originalB1e = 'async function Oxe(){return process.platform!=="darwin"?null:await Rxe()}';
const replacementB1e = 'async function Oxe(){return process.platform!=="darwin"&&process.platform!=="linux"?null:await Rxe()}';

if (indexContent.includes(originalB1e)) {
  indexContent = indexContent.replace(originalB1e, replacementB1e);
  console.log('  Patched Oxe() for Linux\n');
} else {
  console.log('  WARNING: Oxe() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 06 applied\n');

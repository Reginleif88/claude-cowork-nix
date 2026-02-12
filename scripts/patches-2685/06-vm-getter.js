#!/usr/bin/env node
/**
 * Patch 06: VM Getter Override (for Claude Desktop 1.1.2685)
 *
 * Patches Ii() to return our Linux VM instance.
 * Also patches B1e() to not short-circuit on non-darwin.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 06: VM Getter Override (2685) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.06-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch 6a: Ii() - return our VM instance on Linux
const originalIi = 'async function Ii(){const t=await F1e();return(t==null?void 0:t.vm)??null}';
const replacementIi = `async function Ii(){if(process.platform==="linux"&&global.__linuxCowork&&global.__linuxCowork.vmInstance){console.log("[Cowork Linux] Ii() returning Linux VM");return global.__linuxCowork.vmInstance}const t=await F1e();return(t==null?void 0:t.vm)??null}`;

if (indexContent.includes(originalIi)) {
  indexContent = indexContent.replace(originalIi, replacementIi);
  console.log('  Patched Ii() for Linux VM\n');
} else {
  console.log('  WARNING: Ii() pattern not found\n');
}

// Patch 6b: B1e() - don't return null on Linux
// Original: async function B1e(){return process.platform!=="darwin"?null:await F1e()}
const originalB1e = 'async function B1e(){return process.platform!=="darwin"?null:await F1e()}';
const replacementB1e = 'async function B1e(){return process.platform!=="darwin"&&process.platform!=="linux"?null:await F1e()}';

if (indexContent.includes(originalB1e)) {
  indexContent = indexContent.replace(originalB1e, replacementB1e);
  console.log('  Patched B1e() for Linux\n');
} else {
  console.log('  WARNING: B1e() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 06 applied\n');

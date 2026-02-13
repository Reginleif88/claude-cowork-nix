#!/usr/bin/env node
/**
 * Patch 03: Availability Check (for Claude Desktop 1.1.2998)
 *
 * Patches vz() to return {status:"supported"} on Linux.
 *
 * v2685: function N7(){...
 * v2998: function vz(){...
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 03: Availability Check (2998) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.03-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch vz() to allow Linux
const original = 'function vz(){const t=process.platform;if(t!=="darwin"&&t!=="win32")return{status:"unsupported"';
const replacement = 'function vz(){if(process.platform==="linux"&&global.__linuxCowork)return{status:"supported"};const t=process.platform;if(t!=="darwin"&&t!=="win32")return{status:"unsupported"';

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched vz() for Linux support\n');
} else {
  console.log('  WARNING: vz() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 03 applied\n');

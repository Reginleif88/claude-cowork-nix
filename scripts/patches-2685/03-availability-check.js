#!/usr/bin/env node
/**
 * Patch 03: Availability Check (for Claude Desktop 1.1.2685)
 *
 * Patches N7() to return {status:"supported"} on Linux.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 03: Availability Check (2685) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.03-backup', indexContent); } catch (e) { /* read-only fs */ }

// Patch N7() to allow Linux
const original = 'function N7(){const t=process.platform;if(t!=="darwin"&&t!=="win32")return{status:"unsupported"';
const replacement = 'function N7(){if(process.platform==="linux"&&global.__linuxCowork)return{status:"supported"};const t=process.platform;if(t!=="darwin"&&t!=="win32")return{status:"unsupported"';

if (indexContent.includes(original)) {
  indexContent = indexContent.replace(original, replacement);
  console.log('  Patched N7() for Linux support\n');
} else {
  console.log('  WARNING: N7() pattern not found\n');
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 03 applied\n');

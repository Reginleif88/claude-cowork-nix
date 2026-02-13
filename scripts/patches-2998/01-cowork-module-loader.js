#!/usr/bin/env node
/**
 * Patch 01: Load Linux Cowork Module (for Claude Desktop 1.1.2998)
 *
 * Appends an IIFE to index.js that loads the claude-cowork-linux module.
 * Includes process guard to prevent renderer crashes.
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const SOURCE_ROOT = process.argv[3] || path.join(__dirname, '../..');
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');
const COWORK_MODULE_PATH = path.join(EXTRACTED_DIR, 'node_modules/claude-cowork-linux');
const SOURCE_MODULE = path.join(SOURCE_ROOT, 'modules/claude-cowork-linux.js');

console.log('=== Patch 01: Cowork Module Loader (2998) ===\n');

// Install claude-cowork-linux module
console.log('[1/3] Installing claude-cowork-linux module...');
if (!fs.existsSync(COWORK_MODULE_PATH)) {
  fs.mkdirSync(COWORK_MODULE_PATH, { recursive: true });
}

fs.copyFileSync(SOURCE_MODULE, path.join(COWORK_MODULE_PATH, 'index.js'));
fs.writeFileSync(
  path.join(COWORK_MODULE_PATH, 'package.json'),
  JSON.stringify({
    name: 'claude-cowork-linux',
    version: '2.0.0',
    main: 'index.js',
  }, null, 2)
);
console.log('  Module installed\n');

// Read index.js
console.log('[2/3] Reading index.js...');
let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');
try { fs.writeFileSync(INDEX_JS_PATH + '.01-backup', indexContent); } catch (e) { /* read-only fs */ }

// Append cowork initialization
console.log('[3/3] Appending Cowork initialization...\n');

const coworkPatch = `
;(function(){
  // Linux Cowork Implementation (v2 for 1.1.2998)
  // CRITICAL: Check process type FIRST to prevent renderer crashes
  if (process.type !== 'browser') return;
  if (process.platform !== 'linux') return;

  console.log('[Cowork] Linux Cowork initialization starting...');

  try {
    const {CoworkSessionManager, VMCompatibilityAdapter} =
      require('claude-cowork-linux');

    global.__linuxCowork = {
      manager: new CoworkSessionManager(),
      adapter: VMCompatibilityAdapter,
      version: '2.0.0-linux',
      platform: 'bubblewrap'
    };

    console.log('[Cowork] Linux Cowork enabled via bubblewrap');

    const {CoworkSessionManager: CSM} = require('claude-cowork-linux');
    if (CSM.isAvailable && CSM.isAvailable()) {
      console.log('[Cowork] Bubblewrap available:', CSM.getVersion ? CSM.getVersion() : 'unknown');
    } else {
      console.warn('[Cowork] Bubblewrap not found at expected path');
    }
  } catch(e) {
    console.error('[Cowork] Failed to load Linux Cowork:', e.message);
  }
})();
`;

indexContent += coworkPatch;
fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('Patch 01 applied\n');

#!/usr/bin/env node
/**
 * Patch 08: Tray Icon Linux (for Claude Desktop 1.1.2321)
 *
 * Two fixes for tray icons on Linux:
 *
 * 1. Patch Iyt() to return the real filesystem path for icon directory.
 *    COSMIC's SNI protocol reads icons via D-Bus IconThemePath, but can't
 *    read from ASAR archives. By pointing to the real filesystem path
 *    (alongside the ASAR), the tray icon displays correctly.
 *
 * 2. Patch tray icon filename selection. Since patch 02 sets sa=true for
 *    Linux (to route through the TS VM path), the tray code incorrectly
 *    picks Windows .ico files. This adds a Linux check before the sa
 *    ternary so Linux uses theme-aware PNG icons instead.
 *
 * Dark mode (dark panel) -> TrayIconTemplate-Dark.png (light icon)
 * Light mode (light panel) -> TrayIconTemplate.png (dark icon)
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 08: Tray Icon Linux (2321) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');

// --- Part A: Patch Iyt() to return real filesystem path on Linux ---
//
// Original:
//   function Iyt(){return Ae.app.isPackaged?Ma.resourcesPath:$e.resolve(__dirname,"..","..","resources")}
//
// On Linux we return path.join(path.dirname(app.getAppPath()), "resources")
// which resolves to /nix/store/.../lib/claude-desktop/resources/
// (the real filesystem directory alongside app.asar)

const iytOriginal = 'function Iyt(){return Ae.app.isPackaged?Ma.resourcesPath:$e.resolve(__dirname,"..","..","resources")}';
const iytReplacement = 'function Iyt(){return process.platform==="linux"?$e.join($e.dirname(Ae.app.getAppPath()),"resources"):Ae.app.isPackaged?Ma.resourcesPath:$e.resolve(__dirname,"..","..","resources")}';

const iytCount = (indexContent.match(new RegExp(iytOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`  Iyt() pattern occurrences: ${iytCount}`);

if (iytCount === 1) {
  indexContent = indexContent.replace(iytOriginal, iytReplacement);
  console.log('  Patched Iyt() icon directory resolver for Linux');
} else if (iytCount === 0) {
  console.log('  WARNING: Iyt() pattern not found');
  process.exit(1);
} else {
  console.log(`  WARNING: Expected 1 Iyt() occurrence, found ${iytCount}`);
  process.exit(1);
}

// --- Part B: Patch tray icon filename selection ---
//
// Original:
//   sa?e=Ae.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"
//
// Prepend Linux check so Linux uses PNGs with dark/light awareness:
//   process.platform==="linux"?(e=Ae.nativeTheme.shouldUseDarkColors?"TrayIconTemplate-Dark.png":"TrayIconTemplate.png"):sa?...

const iconOriginal = 'sa?e=Ae.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"';
const iconReplacement = 'process.platform==="linux"?(e=Ae.nativeTheme.shouldUseDarkColors?"TrayIconTemplate-Dark.png":"TrayIconTemplate.png"):sa?e=Ae.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"';

const iconCount = (indexContent.match(new RegExp(iconOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`  Icon filename pattern occurrences: ${iconCount}`);

if (iconCount === 1) {
  indexContent = indexContent.replace(iconOriginal, iconReplacement);
  console.log('  Patched tray icon filename selection for Linux');
} else if (iconCount === 0) {
  console.log('  WARNING: Icon filename pattern not found');
  process.exit(1);
} else {
  console.log(`  WARNING: Expected 1 icon filename occurrence, found ${iconCount}`);
  process.exit(1);
}

fs.writeFileSync(INDEX_JS_PATH, indexContent);
console.log('\nPatch 08 applied\n');

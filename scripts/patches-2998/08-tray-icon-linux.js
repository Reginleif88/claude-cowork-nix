#!/usr/bin/env node
/**
 * Patch 08: Tray Icon Linux (for Claude Desktop 1.1.2998)
 *
 * Two fixes for tray icons on Linux:
 *
 * 1. Patch hxt() to return the real filesystem path for icon directory.
 *    COSMIC's SNI protocol reads icons via D-Bus IconThemePath, but can't
 *    read from ASAR archives. By pointing to the real filesystem path
 *    (alongside the ASAR), the tray icon displays correctly.
 *
 * 2. Patch tray icon filename selection. Since patch 02 sets Li=true for
 *    Linux (to route through the TS VM path), the tray code incorrectly
 *    picks Windows .ico files. This adds a Linux check before the Li
 *    ternary so Linux uses theme-aware PNG icons instead.
 *
 * Dark mode (dark panel) -> TrayIconTemplate-Dark.png (light icon)
 * Light mode (light panel) -> TrayIconTemplate.png (dark icon)
 *
 * v2685: nSt(), Pe (electron), Te (path), _a (resources), Hi (flag)
 * v2998: hxt(), Te (electron), Pe (path), Sa (resources), Li (flag)
 */
const fs = require('fs');
const path = require('path');

const EXTRACTED_DIR = process.argv[2] || '/tmp/app-extracted';
const INDEX_JS_PATH = path.join(EXTRACTED_DIR, '.vite/build/index.js');

console.log('=== Patch 08: Tray Icon Linux (2998) ===\n');

let indexContent = fs.readFileSync(INDEX_JS_PATH, 'utf8');

// --- Part A: Patch hxt() to return real filesystem path on Linux ---
//
// Original:
//   function hxt(){return Te.app.isPackaged?Sa.resourcesPath:Pe.resolve(__dirname,"..","..","resources")}
//
// On Linux we return Pe.join(Pe.dirname(Te.app.getAppPath()), "resources")
// which resolves to /nix/store/.../lib/claude-desktop/resources/
// (the real filesystem directory alongside app.asar)

const nStOriginal = 'function hxt(){return Te.app.isPackaged?Sa.resourcesPath:Pe.resolve(__dirname,"..","..","resources")}';
const nStReplacement = 'function hxt(){return process.platform==="linux"?Pe.join(Pe.dirname(Te.app.getAppPath()),"resources"):Te.app.isPackaged?Sa.resourcesPath:Pe.resolve(__dirname,"..","..","resources")}';

const nStCount = (indexContent.match(new RegExp(nStOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`  hxt() pattern occurrences: ${nStCount}`);

if (nStCount === 1) {
  indexContent = indexContent.replace(nStOriginal, nStReplacement);
  console.log('  Patched hxt() icon directory resolver for Linux');
} else if (nStCount === 0) {
  console.log('  WARNING: hxt() pattern not found');
  process.exit(1);
} else {
  console.log(`  WARNING: Expected 1 hxt() occurrence, found ${nStCount}`);
  process.exit(1);
}

// --- Part B: Patch tray icon filename selection ---
//
// Original:
//   Li?e=Te.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"
//
// Prepend Linux check so Linux uses PNGs with dark/light awareness:
//   process.platform==="linux"?(e=Te.nativeTheme.shouldUseDarkColors?"TrayIconTemplate-Dark.png":"TrayIconTemplate.png"):Li?...

const iconOriginal = 'Li?e=Te.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"';
const iconReplacement = 'process.platform==="linux"?(e=Te.nativeTheme.shouldUseDarkColors?"TrayIconTemplate-Dark.png":"TrayIconTemplate.png"):Li?e=Te.nativeTheme.shouldUseDarkColors?"Tray-Win32-Dark.ico":"Tray-Win32.ico":e="TrayIconTemplate.png"';

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

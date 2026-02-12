#!/usr/bin/env node
/**
 * Patch 07: Platform Branding (for Claude Desktop 1.1.2685)
 *
 * Ensures "Claude for Linux" is displayed instead of "Claude for Windows" or
 * "Claude for Mac" in all windows. The about window renderer already handles
 * Linux correctly via process.platform, but the claude.ai web content loaded
 * in the main view may show incorrect platform branding. This patch injects
 * a DOM observer into the mainView preload to fix it.
 */

const fs = require('fs');
const path = require('path');

const extractedDir = process.argv[2];
if (!extractedDir) {
  console.error('Usage: node 07-platform-branding.js <extracted-app-dir>');
  process.exit(1);
}

const mainViewPreload = path.join(extractedDir, '.vite', 'build', 'mainView.js');

if (!fs.existsSync(mainViewPreload)) {
  console.error(`mainView.js not found at: ${mainViewPreload}`);
  process.exit(1);
}

// Inject a platform branding fix into the mainView preload.
// This runs in the preload context with contextIsolation, but still has DOM access.
const brandingFix = `
;(function() {
  if (process.platform !== "linux") return;
  function fixPlatformText(node) {
    if (node.nodeType === 3) {
      var t = node.textContent;
      if (t && (t.includes("for Windows") || t.includes("for Mac"))) {
        node.textContent = t.replace(/for Windows/g, "for Linux").replace(/for Mac/g, "for Linux");
      }
    } else if (node.childNodes) {
      for (var i = 0; i < node.childNodes.length; i++) {
        fixPlatformText(node.childNodes[i]);
      }
    }
  }
  function scanDocument() {
    if (document.body) fixPlatformText(document.body);
    if (document.title && (document.title.includes("for Windows") || document.title.includes("for Mac"))) {
      document.title = document.title.replace(/for Windows/g, "for Linux").replace(/for Mac/g, "for Linux");
    }
  }
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.addedNodes) {
        for (var j = 0; j < m.addedNodes.length; j++) {
          fixPlatformText(m.addedNodes[j]);
        }
      }
      if (m.type === "characterData" && m.target.nodeType === 3) {
        var t = m.target.textContent;
        if (t && (t.includes("for Windows") || t.includes("for Mac"))) {
          m.target.textContent = t.replace(/for Windows/g, "for Linux").replace(/for Mac/g, "for Linux");
        }
      }
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      scanDocument();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  } else {
    scanDocument();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener("load", scanDocument);
})();
`;

let content = fs.readFileSync(mainViewPreload, 'utf8');

// Check if already patched
if (content.includes('fixPlatformText')) {
  console.log('[07-platform-branding] Already patched, skipping');
  process.exit(0);
}

content += brandingFix;
fs.writeFileSync(mainViewPreload, content, 'utf8');

console.log('[07-platform-branding] Injected platform branding fix into mainView.js');
console.log('[07-platform-branding] "for Windows"/"for Mac" text will be replaced with "for Linux"');

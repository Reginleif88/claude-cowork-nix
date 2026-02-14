# Design: Regex-Based Version-Resilient Patching

**Date:** 2026-02-14
**Status:** Approved

## Problem

Each Claude Desktop release changes minified JavaScript identifier names. The current exact-match Node.js patches break every time, requiring ~30 minutes of manual grep work per version bump. The auto-update CI creates PRs that can never be auto-merged.

## Solution

Replace version-specific exact-match patches with version-resilient `perl -pe` regex substitutions using `\w+` wildcards for identifiers, plus one dynamic Node.js script for the complex VM start injection.

## Design

### Removed

- `scripts/patches-2998/` — old version-specific patches
- `scripts/patches-3189/` — current version-specific patches

### Added

- `scripts/patch-vm-start.js` — dynamically discovers function name via `[VM:start]` log string and injects bubblewrap session block
- `scripts/cowork-init.js` — the IIFE appended to index.js (extracted from patch 01)
- `scripts/branding-fix.js` — the DOM observer IIFE appended to mainView.js (extracted from patch 07)
- Tray stability patches (debounce, DBus cleanup, window blur) from claude-desktop-linux-flake

### Modified

- `flake.nix` `buildPhase` — inline perl regex commands replace Node.js script calls

### Patch mapping

| # | Purpose | Method | Version-dependent? |
|---|---------|--------|--------------------|
| 00 | Native module stub | `cp` + `writeFile` in nix | No |
| 01 | Cowork module loader | `cp` module + `cat >>` IIFE | No |
| 02 | Platform flag | `perl -pe` with `\w+` capture | No |
| 03 | Availability check | `perl -pe` with `\w+` capture | No |
| 04 | Skip download | `perl -pe` with `\w+` capture | No |
| 05 | VM start intercept | `scripts/patch-vm-start.js` dynamic discovery | No |
| 06 | VM getter | `perl -pe` with `\w+` capture | No |
| 07 | Platform branding | `cat >>` IIFE to mainView.js | No |
| 08 | Tray icon | `perl -pe` with `\w+` capture | No |
| NEW | Tray stability | `perl -pe` regexes from other project | No |

### Verification

Each regex patch is followed by a `grep -qP` check. If the expected post-patch pattern isn't found, the build aborts with a descriptive error.

### Success criteria

- `nix build .` and `nix build .#claude-desktop-fhs` succeed
- Build log shows zero WARNING lines
- All regex patterns verified against v1.1.3189 extracted index.js
- Auto-update version bump PRs can be tested without manual patch updates

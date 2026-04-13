# Patching Architecture

This document describes the patching approach used in `claude-cowork-nix` to make Claude Desktop run on Linux with Cowork support.

## Approach

A **hybrid** strategy combining inline `perl -pe` regex substitutions with a dynamic Node.js script:

- **7 regex patches** (02, 03, 04, 06a, 06b, 08a, 08b, 09) use `perl -pe` with `\w+` wildcards for minified identifiers, applied directly in the Nix build phase
- **1 dynamic patch** (05) uses a Node.js script that discovers the VM start function by its `[VM:start]` log string, then injects the Linux session block
- **2 file-based patches** (00, 01, 07) append or copy standalone JavaScript files
- Each regex patch is verified with a `grep -qP` post-check that fails the build on mismatch

This approach has survived across v1.1.2685, v1.1.3770, and v1.1348.0 (including a major versioning scheme change) without requiring patch rewrites for most patches.

## Why Regex Works

Claude Desktop ships as minified Electron JavaScript. Each release renames identifiers (`Li` → `Ci`, `vz()` → `fz()`), but the **code structure** is stable:

```perl
# The structure process.platform==="darwin",WORD=process.platform==="win32" is stable
# Only the variable name (WORD) changes — \w+ matches any name
perl -pe 's{(\w+=process\.platform==="darwin",)(\w+)(=process\.platform==="win32")}{...}'
```

The key insight: each function has a **stable semantic signature** (string literals, API calls, structure) that survives minification. Only the names change.

## Identifier Discovery Patterns

When a version bump breaks a patch, these grep patterns find the new targets:

```bash
INDEX=extracted/.vite/build/index.js

# Patch 02: Platform flag
grep -oP '.{0,60}process\.platform==="darwin",.{0,4}=process\.platform==="win32".{0,20}' $INDEX

# Patch 03: Availability check
grep -oP 'function \w+\(\)\{const t=process\.platform;if\(t!=="darwin"&&t!=="win32"\)return\{status:"unsupported"' $INDEX

# Patch 05: VM start (4-param async with [VM:start] log)
grep -oP 'async function \w+\(\w,\w,\w,\w\)\{var .{0,80}\[VM:start\]' $INDEX

# Patch 06a: VM getter
grep -oP 'async function \w+\(\)\{const t=await \w+\(\);return\(t==null\?void 0:t\.vm\)\?\?null\}' $INDEX

# Patch 08b: Tray icon filename
grep -oP '\w+\?\w+=\w+\.nativeTheme\.shouldUseDarkColors\?"Tray-Win32-Dark\.ico":"Tray-Win32\.ico":\w+="TrayIconTemplate\.png"' $INDEX

# Patch 10: ClaudeCode platform throw
grep -oP 'if\(process\.platform==="win32"\)return \w+==="arm64"\?"win32-arm64":"win32-x64";throw new Error\(`Unsupported platform:' $INDEX

# Patch 11: shellPathWorker base
grep -oP 'function \w+\(\)\{return \w+\.join\(process\.resourcesPath,"app\.asar",".vite","build","shell-path-worker","shellPathWorker\.js"\)\}' $INDEX
```

## Wrapped-Electron Path Resolution Gotcha

In a Nix build that wraps a stock Electron with `makeWrapper` and passes `app.asar` as a positional argument:

```
electron /nix/store/<hash>-claude-desktop-<ver>/lib/claude-desktop/app.asar
```

…`process.resourcesPath` resolves to the **Electron runtime's** resources directory (`/nix/store/<hash>-electron-unwrapped-<ver>/.../resources`), NOT the directory containing Claude's app.asar. Anthropic's code assumes a normal "Electron app" layout where `process.resourcesPath` IS the directory containing app.asar (the macOS/Windows install pattern).

When a patch needs to resolve a file inside Claude's app.asar at runtime, use one of:

1. `process.argv[1]` — the asar path passed by `makeWrapper`. Pass it directly to `path.join(...)` to address files inside the archive (Electron's `fs` patches make `app.asar` behave as both a file AND a directory containing its archived contents). Used by patch 11.
2. `app.getAppPath()` — the Electron-internal "app path" API, which on a wrapped build returns the asar path. Used by patch 08a.

Either works; pick whichever matches the existing code's idiom around the patch site to minimize regex churn.

**Subtle gotcha**: don't `path.dirname(process.argv[1])` thinking you need a "real" directory before `path.join`-ing — that strips off `app.asar` and leaves you pointing at the directory *next to* the archive, where the file doesn't exist on disk. The asar path itself is the right base.

## Version Update Workflow

1. Get new DMG URL from `https://claude.ai/download`
2. Update `claudeVersion`, `claudeDmgUrl`, `claudeDmgHash` in `flake.nix`
3. `nix build .` — if it succeeds, all patches are still valid
4. If a patch fails, the `grep -qP` check identifies which one — use the discovery patterns above to find the new code structure

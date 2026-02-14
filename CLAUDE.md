# claude-for-linux

Enabling macOS-only Claude Desktop features on Linux via runtime patching.

## Architecture

- **Source**: macOS DMG fetched via `fetchurl` (v1.1.3189)
- **Extraction**: `dmg2img` + `7z` + `asar_tool.py`
- **Runtime**: `electron_37` from nixpkgs
- **Packaging**: Nix flake with `makeWrapper` + `buildFHSEnv`

## Key Commands

```bash
# Build
nix build .                     # Default (direct electron wrapper)
nix build .#claude-desktop-fhs  # FHS wrapper (Cowork + MCP)
nix build .#claude-app          # Just the patched app.asar

# Run
nix run .
nix run .#claude-desktop-fhs

# Validate
nix flake check

# Dev shell
nix develop
```

## Patching Workflow (Version Updates)

When a new Claude Desktop version is released, the auto-update CI creates a PR bumping `flake.nix` (version, hash, URL). The patches will almost certainly break because the minified JS identifiers change each release. Here's how to fix them:

### 1. Extract index.js from the new DMG

```bash
# The failed nix build will cache the DMG. Find it:
nix build . 2>&1 | grep '.dmg.drv'
# Or extract manually:
mkdir -p /tmp/claude-extract && cd /tmp/claude-extract
dmg2img /nix/store/<hash>-Claude-<sha>.dmg claude.img
mkdir -p dmg-contents && 7z x -y -odmg-contents claude.img > /dev/null 2>&1
python3 tools/asar_tool.py extract dmg-contents/Claude/Claude.app/Contents/Resources/app.asar extracted
```

### 2. Find new minified identifiers

Each patch targets specific minified function/variable names. Search for **semantic patterns** — the code logic is stable, only identifiers change.

| Patch | Search strategy |
|-------|----------------|
| 02 | `grep -oP '\w+=process\.platform==="win32"' index.js` — find near `darwin` pair |
| 03 | `grep -oP 'function \w+\(\)\{const t=process\.platform;if\(t!=="darwin"' index.js` |
| 04 | `grep -oP 'async function \w+.*downloadVM' index.js` — the download guard function |
| 05 | `grep -oP 'async function \w+\(\w,\w,\w,\w\).*\[VM:start\]' index.js` |
| 06 | `grep -oP 'async function \w+\(\)\{const t=await \w+\(\);return\(t==null.*\.vm\)' index.js` |
| 06b | `grep -oP 'async function \w+\(\)\{return process\.platform!=="darwin"\?null' index.js` |
| 08 | `grep -oP 'function \w+\(\)\{return \w+\.app\.isPackaged\?\w+\.resourcesPath' index.js` |
| 08b | `grep -oP '\w+\?\w+=\w+\.nativeTheme\.shouldUseDarkColors\?"Tray-Win32' index.js` |

**Important**: Check if `Pe`/`Te` (electron/path) have swapped — they alternate between versions.

### 3. Create new patches directory

```bash
mkdir scripts/patches-XXXX
cp scripts/patches-3189/00-native-module-stub.js scripts/patches-XXXX/  # never changes
cp scripts/patches-3189/01-cowork-module-loader.js scripts/patches-XXXX/  # never changes
cp scripts/patches-3189/07-platform-branding.js scripts/patches-XXXX/  # never changes
# Update 02, 03, 04, 05, 06, 08 with new identifiers
```

### 4. Update flake.nix

Update all `patches-3189` references to `patches-XXXX`.

### 5. Build and verify

```bash
git add scripts/patches-XXXX/  # flake needs files tracked
nix build .                     # check for WARNING lines
nix build .#claude-desktop-fhs  # verify FHS variant too
```

### Identifier History

| Purpose | v2685 | v2998 | v3189 |
|---------|-------|-------|-------|
| Platform flag | `Hi` | `Li` | `Ci` |
| Availability | `N7()` | `vz()` | `fz()` |
| Download guard | `Qke()` | `gTe()` | `zTe()` |
| VM start | `D0t()` | `i0t()` | `v_t()` |
| VM getter | `Ii()` | `_i()` | `Ei()` |
| Platform getter | `B1e()` | `Oxe()` | `aAe()` |
| Internal getter | `F1e()` | `Rxe()` | `iAe()` |
| Resource path | `nSt()` | `hxt()` | `RAt()` |
| Status dispatch | `lC(Ih.X)` | `g2(pf.X)` | `x2(wf.X)` |
| electron module | `Pe` | `Te` | `Pe` |
| path module | `Te` | `Pe` | `Te` |
| resources | `_a` | `Sa` | `xa` |

## Patch Chain (v1.1.3189)

| # | File | Target | Purpose |
|---|------|--------|---------|
| 00 | native-module-stub | `@ant/claude-native` | Electron API stubs for Linux |
| 01 | cowork-module-loader | (append) | Load bubblewrap module with process guard |
| 02 | platform-flag | `Ci=process.platform==="win32"` | Route Linux through TS VM path |
| 03 | availability-check | `fz()` | Return supported for Linux |
| 04 | skip-download | `zTe(t,e)` | Skip macOS VM bundle download |
| 05 | vm-start-intercept | `v_t(t,e,r,n)` | Create bubblewrap session, dispatch Ready |
| 06 | vm-getter | `Ei()` + `aAe()` | Return Linux VM instance |
| 07 | platform-branding | mainView.js preload | Replace "for Windows"/"for Mac" with "for Linux" |
| 08 | tray-icon-linux | `RAt()` + tray ternary | Use theme-aware PNGs instead of Windows ICOs |

## Electron Gotchas

- **Process types**: Main (type='browser') vs renderer - only main can access Node.js
- **ASAR tool**: Use `tools/asar_tool.py` not `npx asar` (has bugs)
- **App caching**: Kill all processes with `pkill -f claude-desktop` before testing
- **ChildProcess objects**: Can't add methods via assignment - use Proxy

## Current State

See `COWORK_PROGRESS.md` for detailed status of Cowork Linux implementation.

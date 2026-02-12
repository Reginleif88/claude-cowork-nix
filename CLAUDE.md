# claude-for-linux

Enabling macOS-only Claude Desktop features on Linux via runtime patching.

## Architecture

- **Source**: macOS DMG fetched via `fetchurl` (v1.1.2685)
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

## Patching Workflow

1. **Fetch DMG URL**: `curl -sI https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect | grep location`
2. **Update hash**: `nix-prefetch-url <url>` then convert to SRI
3. **Extract index.js**: Build with `-L` to see extraction, or use dev shell
4. **Find patterns**: `grep -oP '.{0,50}PATTERN.{0,50}' index.js`
5. **Update patches**: Edit `scripts/patches-2685/*.js`
6. **Test**: `nix build . && nix run .`

## Patch Chain (v1.1.2685)

| # | File | Target | Purpose |
|---|------|--------|---------|
| 00 | native-module-stub | `@ant/claude-native` | Electron API stubs for Linux |
| 01 | cowork-module-loader | (append) | Load bubblewrap module with process guard |
| 02 | platform-flag | `Hi=process.platform==="win32"` | Route Linux through TS VM path |
| 03 | availability-check | `N7()` | Return supported for Linux |
| 04 | skip-download | `Qke(t,e)` | Skip macOS VM bundle download |
| 05 | vm-start-intercept | `D0t(t,e,r,n)` | Create bubblewrap session, dispatch Ready |
| 06 | vm-getter | `Ii()` + `B1e()` | Return Linux VM instance |
| 07 | platform-branding | mainView.js preload | Replace "for Windows"/"for Mac" with "for Linux" |
| 08 | tray-icon-linux | tray icon ternary | Use theme-aware PNGs instead of Windows ICOs |

## Electron Gotchas

- **Process types**: Main (type='browser') vs renderer - only main can access Node.js
- **ASAR tool**: Use `tools/asar_tool.py` not `npx asar` (has bugs)
- **App caching**: Kill all processes with `pkill -f claude-desktop` before testing
- **ChildProcess objects**: Can't add methods via assignment - use Proxy

## Current State

See `COWORK_PROGRESS.md` for detailed status of Cowork Linux implementation.

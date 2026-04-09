# Cowork on Linux - Progress Report

## Current Status: v1.1348.0 NixOS Package

Cowork (macOS-only sandboxed directory access) is being enabled on Linux using bubblewrap namespace sandboxing, packaged as a fully declarative Nix flake.

### What Works

1. **Full Nix build pipeline**: DMG fetch via `7zz` (LZFSE support), extract, patch, repack, electron wrap
2. **All 10 patches apply cleanly** to v1.1348.0 minified code using version-resilient regex
3. **Two package variants**: direct electron wrapper + FHS `buildFHSEnv`
4. **NixOS + Home Manager modules** with `programs.claude-desktop.enable`
5. **Cowork UI integration**: Toggle appears in settings
6. **Platform routing**: Linux routed through TypeScript VM path (patch 02)
7. **Availability check**: Returns "supported" for Linux (patch 03)
8. **Bundle download skip**: Short-circuits on Linux (patch 04)
9. **VM start intercept**: Creates bubblewrap session via dynamic discovery (patch 05)
10. **Dynamic bwrap path**: Finds bubblewrap via `BWRAP_PATH` env, PATH lookup, or common locations
11. **Persistent auth tokens**: `--password-store=gnome-libsecret` works with KDE Wallet and GNOME Keyring
12. **Tray icons**: Theme-aware PNGs for Linux (patch 08)
13. **Platform branding**: UI shows "for Linux" instead of "for Windows"/"for Mac" (patch 07)

### Status: Testing Needed

- **Cowork end-to-end**: Directory picker -> bubblewrap sandbox -> file operations
- **stdin/stdout communication**: Known issue from v1.1.1200 (Proxy-based writeStdin)
- **TypeScript VM path integration**: May provide cleaner IPC

## Architecture

### VM Path Routing

Claude Desktop has two VM paths: macOS via `@ant/claude-swift` (Swift native module) and Windows via a TypeScript VM client over IPC sockets. By setting the platform flag (patch 02), Linux routes through the TypeScript path. The VM start function (patch 05) then creates a bubblewrap session instead of connecting to a Windows IPC server.

### Patch Chain (v1.1348.0)

All patches use version-resilient `\w+` regex wildcards for minified identifiers. Function names are discovered at build time, not hardcoded.

| # | Method | Purpose |
|---|--------|---------|
| 00 | File copy | Electron API stubs for Linux (`@ant/claude-native`) |
| 01 | Append IIFE | Load bubblewrap Cowork module |
| 02 | `perl -pe` regex | Route Linux through VM path (platform flag) |
| 03 | `perl -pe` regex | Return "supported" for Linux availability |
| 04 | `perl -pe` regex | Skip macOS VM bundle download |
| 05 | Node.js dynamic | Create bubblewrap session at VM start (discovers function via `[VM:start]` log) |
| 06 | `perl -pe` regex | Return Linux VM instance from getters |
| 07 | Append IIFE | Replace "for Windows"/"for Mac" with "for Linux" |
| 08 | `perl -pe` regex | Use theme-aware PNGs for tray icon |
| 09 | `perl -pe` regex | DBus tray cleanup delay for stability |

### Linux Implementation

**CoworkSessionManager** (`modules/claude-cowork-linux.js`):
- `createSession()`: Creates isolated session directory
- `spawnSandboxed()`: Spawns processes with bubblewrap
- `addMount()`: Configures bind mounts
- `destroySession()`: Cleanup
- Dynamic bwrap path: `BWRAP_PATH` env > PATH lookup > fallback locations

**Bubblewrap Isolation**:
```bash
bwrap \
  --ro-bind /usr /usr --ro-bind /lib /lib \
  --proc /proc --dev /dev --tmpfs /tmp \
  --bind /host/path /vm/path \
  --unshare-pid --unshare-ipc --die-with-parent \
  command args
```

## Key Learnings

1. **Electron process types**: Main (type='browser') vs renderer - only main can access Node.js
2. **Status signals**: UI state machine waits for Ready dispatch - without it, infinite spinner
3. **ChildProcess limitations**: Can't add methods via assignment - use Proxy
4. **LZFSE compression**: Newer macOS DMGs use LZFSE which `dmg2img` can't handle; `7zz` (7-Zip v26+) supports it natively
5. **Electron safeStorage**: Needs `--password-store=gnome-libsecret` on Linux to use `org.freedesktop.secrets` (served by KDE Wallet or GNOME Keyring)
6. **`await` in non-async context**: Causes SyntaxError that crashes the entire module at parse time - use synchronous alternatives

## Next Steps

1. Test Cowork end-to-end on NixOS
2. Fix stdin/stdout communication for process I/O
3. Test MCP servers with FHS variant
4. Implement `getWindowsElevationType` in native stub to suppress error log

## Installation

```bash
# Build
nix build .

# Run
nix run .

# FHS variant (recommended for Cowork)
nix run .#claude-desktop-fhs
```

---

**Last Updated**: 2026-04-09
**Claude Desktop Version**: 1.1348.0
**Status**: Build pipeline complete, app launches, auth token persistence working. Cowork runtime testing needed.

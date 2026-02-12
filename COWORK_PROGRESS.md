# Cowork on Linux - Progress Report

## Current Status: v1.1.2685 NixOS Package

Cowork (macOS-only sandboxed directory access) is being enabled on Linux using bubblewrap namespace sandboxing, packaged as a fully declarative Nix flake.

### What Works

1. **Full Nix build pipeline**: DMG fetch, extract, patch, repack, electron wrap
2. **All 7 patches apply cleanly** to v1.1.2321 minified code
3. **Two package variants**: direct electron wrapper + FHS `buildFHSEnv`
4. **NixOS + Home Manager modules** with `programs.claude-desktop.enable`
5. **Cowork UI integration**: Toggle appears in settings
6. **Platform routing**: Linux routed through TypeScript VM path (patch 02)
7. **Availability check**: NH() returns "supported" for Linux (patch 03)
8. **Bundle download skip**: TCe() short-circuits on Linux (patch 04)
9. **VM start intercept**: ppt() creates bubblewrap session (patch 05)
10. **Dynamic bwrap path**: Finds bubblewrap via `BWRAP_PATH` env, PATH lookup, or common locations

### Status: Testing Needed

- **Cowork end-to-end**: Directory picker -> bubblewrap sandbox -> file operations
- **stdin/stdout communication**: Known issue from v1.1.1200 (Proxy-based writeStdin)
- **TypeScript VM path integration**: New in v1.1.2321, may provide cleaner IPC

## Architecture (v1.1.2321)

### Key Change from v1.1.1200

v1.1.2321 introduced a **TypeScript VM client** (`h7e`) for Windows that communicates over IPC sockets. This is more Linux-friendly than the old macOS-only Swift approach.

By setting the `sa` platform flag to include Linux (patch 02), we route through this TypeScript path instead of trying to load `@ant/claude-swift`.

### Patch Chain (v1.1.2321)

| # | File | Target | Purpose |
|---|------|--------|---------|
| 00 | `00-native-module-stub.js` | `@ant/claude-native` | Install Linux native module (Electron API stubs) |
| 01 | `01-cowork-module-loader.js` | (append to index.js) | Load cowork module with process guard |
| 02 | `02-platform-flag.js` | `sa=process.platform==="win32"` | Route Linux through TypeScript VM path |
| 03 | `03-availability-check.js` | `NH()` | Return `{status:"supported"}` for Linux |
| 04 | `04-skip-download.js` | `TCe(t,e)` | Skip macOS VM bundle download |
| 05 | `05-vm-start-intercept.js` | `ppt(t,e,r,n)` | Create bubblewrap session, dispatch `W1(Ku.Ready)` |
| 06 | `06-vm-getter.js` | `Ai()` + `fwe()` | Return Linux VM instance |

### Pattern Mapping (v1.1.1200 -> v1.1.2321)

| Old (1200) | New (2321) | Purpose |
|-----------|-----------|---------|
| `m6()` | `NH()` | Platform/arch availability check |
| `B_e(t,e)` | `TCe(t,e)` | VM bundle download |
| `$rt(t,e,r)` | `ppt(t,e,r,n)` | VM start function |
| `AE(jf.Ready)` | `W1(Ku.Ready)` | Status dispatch |
| `vi()` | `Ai()` | Get VM instance |
| `fS=(async()=>` | `uwe()` | Module loader |
| N/A | `sa` | Win32 platform flag (now includes Linux) |
| N/A | `h7e` | TypeScript VM client |

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
2. **Status signals**: UI state machine waits for `W1(Ku.Ready)` - without it, infinite spinner
3. **ChildProcess limitations**: Can't add methods via assignment - use Proxy
4. **Minified code fragility**: Function names change between versions, patches must be rewritten
5. **TypeScript VM path**: Windows IPC path in 1.1.2321 is more Linux-friendly than Swift

## Next Steps

1. Test Cowork end-to-end on NixOS with COSMIC desktop
2. Investigate TypeScript VM client (`h7e`) as alternative to full VM mock
3. Fix stdin/stdout communication for process I/O
4. Test MCP servers with FHS variant

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

**Last Updated**: 2026-02-08
**Claude Desktop Version**: 1.1.2685
**Status**: Build pipeline complete, Cowork runtime testing needed

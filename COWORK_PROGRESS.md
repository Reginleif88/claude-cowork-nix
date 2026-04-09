# Cowork on Linux - Progress Report

## Current Status: v1.1348.0 — Cowork Working

Cowork (macOS-only sandboxed directory access) is running on Linux. Claude Code spawns inside Cowork sessions, processes messages, and streams responses via the SDK wire protocol.

### What Works

1. **Full Nix build pipeline**: DMG fetch via `7zz` (LZFSE support), extract, patch, repack, electron wrap
2. **All 10 patches apply cleanly** to v1.1348.0 minified code using version-resilient regex
3. **Two package variants**: direct electron wrapper + FHS `buildFHSEnv`
4. **NixOS + Home Manager modules** with `programs.claude-desktop.enable`
5. **Cowork end-to-end**: Session creation → Claude Code spawn → SDK handshake → MCP init → user message → streaming response
6. **Platform routing**: Linux routed through TypeScript VM path (patch 02)
7. **VM lifecycle**: Session create, spawn, writeStdin, kill, event callbacks all functional
8. **MCP servers in Cowork**: Google Calendar, Chrome, mcp-registry, plugins, scheduled-tasks, session_info, cowork-onboarding all initialize
9. **Persistent auth tokens**: `--password-store=gnome-libsecret` works with KDE Wallet and GNOME Keyring
10. **Tray icons**: Theme-aware PNGs for Linux (patch 08)
11. **Platform branding**: UI shows "for Linux" instead of "for Windows"/"for Mac" (patch 07)

### Known Limitations

- **No bubblewrap sandboxing yet**: Claude Code runs directly on the host (not inside bwrap). NixOS paths are incompatible with the simple bwrap bind-mount approach — needs Nix store mounts.
- **`cowork-plugin-shim.sh` missing**: Plugin permission bridge not implemented (warns in logs but doesn't block functionality)
- **`getWindowsElevationType` error**: Harmless error in logs from native stub missing this Windows-only function
- **VM download error**: `Cannot read properties of undefined (reading 'x64')` — cosmetic, doesn't affect functionality (download is skipped by patch 04)

### What Was Fixed to Get Cowork Working

1. **VM-level `writeStdin(id, data)`**: The app calls `vm.writeStdin()` at the VM level (not per-process). Added process registry (`Map`) and VM-level writeStdin/kill methods.
2. **Spawn parameter order**: VM client's `spawn(id, name, cmd, args, cwd, env, ...)` — had `isResume` in wrong position.
3. **VM-internal cwd paths**: App passes `cwd=/sessions/<name>` (VM-internal). Mapped to host path under cowork session directory.
4. **Newline-delimited JSON**: Claude Code's `--input-format stream-json` requires `\n` after each message. The VM IPC layer sends raw chunks without newlines.
5. **`CLAUDE_CONFIG_DIR`**: App sets this to `/sessions/.../mnt/.claude` (VM path). Mapped to real host directory.
6. **Empty `ANTHROPIC_API_KEY`**: App sets `ANTHROPIC_API_KEY=""` which overrides the OAuth token. Removed empty value.
7. **Claude binary resolution**: App spawns `/usr/local/bin/claude` which doesn't exist on NixOS. Resolves to `~/.local/bin/claude` or Nix profile path.

## Architecture

### VM Path Routing

Claude Desktop has two VM paths: macOS via `@ant/claude-swift` (Swift native module) and Windows via a TypeScript VM client over IPC sockets. By setting the platform flag (patch 02), Linux routes through the TypeScript path. The VM start function (patch 05) then creates a Linux session instead of connecting to a Windows IPC server.

### Patch Chain (v1.1348.0)

All patches use version-resilient `\w+` regex wildcards for minified identifiers. Function names are discovered at build time, not hardcoded.

| # | Method | Purpose |
|---|--------|---------|
| 00 | File copy | Electron API stubs for Linux (`@ant/claude-native`) |
| 01 | Append IIFE | Load Cowork module |
| 02 | `perl -pe` regex | Route Linux through VM path (platform flag) |
| 03 | `perl -pe` regex | Return "supported" for Linux availability |
| 04 | `perl -pe` regex | Skip macOS VM bundle download |
| 05 | Node.js dynamic | Create Linux session at VM start (discovers function via `[VM:start]` log) |
| 06 | `perl -pe` regex | Return Linux VM instance from getters |
| 07 | Append IIFE | Replace "for Windows"/"for Mac" with "for Linux" |
| 08 | `perl -pe` regex | Use theme-aware PNGs for tray icon |
| 09 | `perl -pe` regex | DBus tray cleanup delay for stability |

### Cowork Session Flow

```
User sends message in Cowork UI
  → Sessions bridge creates session + environment
  → VM start function creates Linux vmInstance (patch 05)
  → Process manager calls vm.spawn(id, name, "/usr/local/bin/claude", args, cwd, env, ...)
  → Our spawn resolves claude binary, maps cwd, fixes env
  → Claude Code starts with --input-format stream-json
  → vm.writeStdin(id, data) sends newline-terminated JSON messages
  → Claude Code processes control_request (SDK init, MCP init)
  → Claude Code processes user message, streams response
  → Event callbacks forward stdout/stderr/exit to process manager
  → Response appears in Cowork UI
```

### Linux VM Instance Interface

The vmInstance object (created by patch 05) implements these methods:

| Method | Purpose |
|--------|---------|
| `spawn(id, name, cmd, args, cwd, env, ...)` | Spawn Claude Code with resolved paths and fixed env |
| `writeStdin(id, data)` | Write newline-terminated JSON to process stdin |
| `kill(id, signal)` | Kill a spawned process |
| `isProcessRunning(id)` | Check if process is alive |
| `setEventCallbacks(stdout, stderr, exit, error)` | Register event handlers |
| `isConnected()` / `isGuestConnected()` | Always returns true (no VM to connect to) |
| `installSdk()` / `startVM()` / `stopVM()` | No-ops (uses host Claude Code) |
| `addApprovedOauthToken()` | No-op (OAuth token passed via env) |

## Key Learnings

1. **Electron process types**: Main (type='browser') vs renderer - only main can access Node.js
2. **Status signals**: UI state machine waits for Ready dispatch - without it, infinite spinner
3. **LZFSE compression**: Newer macOS DMGs use LZFSE; `7zz` (7-Zip v26+) supports it natively
4. **Electron safeStorage**: Needs `--password-store=gnome-libsecret` on Linux for `org.freedesktop.secrets`
5. **`await` in non-async context**: SyntaxError crashes the entire module at parse time
6. **Node.js spawn ENOENT**: Reports the binary name but the actual cause is non-existent `cwd` directory
7. **stream-json needs newlines**: Claude Code's `--input-format stream-json` requires `\n` terminators
8. **VM env overrides**: The app sets `CLAUDE_CONFIG_DIR` to VM-internal paths and `ANTHROPIC_API_KEY=""` — both must be fixed for host execution
9. **console.log in Electron**: Goes to process stdout, not to the Winston-based log files — use `appendFileSync` for debug logging during development

## Next Steps

1. Implement bubblewrap sandboxing for Claude Code processes (requires Nix store bind-mounts)
2. Implement `cowork-plugin-shim.sh` for plugin permission bridge
3. Add `getWindowsElevationType` to native stub to suppress error log
4. Test file operations, directory picker, and multi-turn conversations
5. Test MCP servers with FHS variant

---

**Last Updated**: 2026-04-09
**Claude Desktop Version**: 1.1348.0
**Status**: Cowork functional — Claude Code spawns, processes messages, and streams responses on Linux.

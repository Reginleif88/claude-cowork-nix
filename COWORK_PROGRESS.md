# Cowork on Linux - Progress Report

## Current Status: v1.1348.0 — Cowork Functional

Cowork is running on Linux. Claude Code spawns inside Cowork sessions, processes messages via the SDK wire protocol, streams responses, and persists transcripts across app restarts.

### What Works

1. **Full Nix build pipeline**: DMG fetch via `7zz` (LZFSE support), extract, patch, repack, electron wrap
2. **All 10 patches apply cleanly** to v1.1348.0 minified code using version-resilient regex
3. **Two package variants**: direct electron wrapper + FHS `buildFHSEnv`
4. **NixOS + Home Manager modules** with `programs.claude-desktop.enable`
5. **Cowork end-to-end**: Session creation → Claude Code spawn → SDK handshake → MCP init → user message → streaming response
6. **Multi-turn conversations**: Sessions stay alive across multiple messages
7. **File operations**: Read, write, and edit work via Claude Code's tools
8. **Directory picker**: Native folder picker works, directories mount correctly
9. **Transcript persistence**: Chat history survives app restarts (written to desktop app's session storage)
10. **Session directory structure**: Proper `mnt/` directory with symlinks from `additionalMounts`
11. **MCP servers in Cowork**: Google Calendar, Chrome, mcp-registry, plugins, scheduled-tasks, session_info, cowork-onboarding all initialize
12. **Persistent auth tokens**: `--password-store=gnome-libsecret` works with KDE Wallet and GNOME Keyring
13. **Tray icons**: Theme-aware PNGs for Linux (patch 08)
14. **Platform branding**: UI shows "for Linux" instead of "for Windows"/"for Mac" (patch 07)

### Known Limitations

- **Bash tool uses VM paths**: Claude Code generates `/sessions/<name>/mnt/...` paths for shell commands, but these don't exist on the host. It recovers by using `~/` paths, but the initial attempt fails. Needs symlink or path hint.
- **No bubblewrap sandboxing**: Claude Code runs directly on the host. NixOS paths are incompatible with simple bwrap bind-mounts — needs Nix store mounts.
- **Executable file preview blocked**: `.sh`, `.exe` etc. can't be opened in UI file preview — this is upstream security behavior, not a Linux-specific issue.
- **`getAppInfoForFile` missing**: Native stub doesn't implement this, causes harmless error when UI tries to detect which app opens a file.
- **`cowork-plugin-shim.sh` missing**: Plugin permission bridge not implemented (warns in logs, doesn't block functionality).
- **`getWindowsElevationType` error**: Harmless log error from native stub missing this Windows-only function.
- **VM download error**: `Cannot read properties of undefined (reading 'x64')` — cosmetic, download is skipped by patch 04.

### What Was Fixed to Get Cowork Working

1. **VM-level `writeStdin(id, data)`**: The app calls `vm.writeStdin()` at the VM level (not per-process). Added process registry (`Map`) and VM-level writeStdin/kill methods.
2. **Spawn parameter order**: VM client's `spawn(id, name, cmd, args, cwd, env, ...)` — had `isResume` in wrong position.
3. **VM-internal cwd paths**: App passes `cwd=/sessions/<name>` (VM-internal). Mapped to host path under cowork session directory.
4. **Newline-delimited JSON**: Claude Code's `--input-format stream-json` requires `\n` after each message. The VM IPC layer sends raw chunks without newlines.
5. **`CLAUDE_CONFIG_DIR`**: App sets this to `/sessions/.../mnt/.claude` (VM path). Now uses the host path from `additionalMounts[".claude"]` so transcripts are written where the desktop app expects them.
6. **Empty `ANTHROPIC_API_KEY`**: App sets `ANTHROPIC_API_KEY=""` which overrides the OAuth token. Removed empty value.
7. **Claude binary resolution**: App spawns `/usr/local/bin/claude` which doesn't exist on NixOS. Resolves to `~/.local/bin/claude` or Nix profile path.
8. **Session directory structure**: Created proper `mnt/` directory with symlinks from `additionalMounts`. Sorted by depth to handle nested mounts (e.g., `.claude/skills` inside `.claude`).
9. **Path translation**: `_resolvePath()` translates `/sessions/<name>/...` to real host paths for `readFile`, `writeFile`, `mkdir`, `rm`.
10. **`mountPath` implementation**: Was a no-op stub — now creates directory structure for VM mount points.

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
  → Process manager calls vm.spawn(id, name, "/usr/local/bin/claude", args, cwd, env, additionalMounts, ...)
  → spawn resolves claude binary path for NixOS
  → spawn creates session dir with mnt/ structure (symlinks from additionalMounts)
  → spawn maps CLAUDE_CONFIG_DIR to desktop app's session .claude dir
  → Claude Code starts with --input-format stream-json
  → vm.writeStdin(id, data) sends newline-terminated JSON messages
  → Claude Code processes control_request (SDK init, MCP init)
  → Claude Code processes user message, streams response
  → Event callbacks forward stdout/stderr/exit to process manager
  → Response appears in Cowork UI
  → Transcript written to desktop app's session storage (persists across restarts)
```

### Session Directory Structure

```
/tmp/claude-cowork-sessions/<sessionId>/sessions/<name>/
├── mnt/
│   ├── .claude -> ~/.config/Claude/.../local_<sessionId>/.claude  (symlink)
│   ├── outputs -> ~/.config/Claude/.../local_<sessionId>/outputs  (symlink)
│   └── uploads -> ~/.config/Claude/.../local_<sessionId>/uploads  (symlink)
```

### Linux VM Instance Interface

The vmInstance object (created by patch 05) implements these methods:

| Method | Purpose |
|--------|---------|
| `spawn(id, name, cmd, args, cwd, env, additionalMounts, ...)` | Spawn Claude Code with resolved paths, mnt/ symlinks, and fixed env |
| `writeStdin(id, data)` | Write newline-terminated JSON to process stdin |
| `kill(id, signal)` | Kill a spawned process |
| `isProcessRunning(id)` | Check if process is alive |
| `setEventCallbacks(stdout, stderr, exit, error)` | Register event handlers |
| `mountPath(processId, subpath, mountName, mode)` | Create directory for VM mount point |
| `readFile(p, enc)` / `writeFile(p, data, enc)` | File I/O with VM path translation |
| `mkdir(p)` / `rm(p)` | Directory ops with VM path translation |
| `isConnected()` / `isGuestConnected()` | Always returns true (no VM to connect to) |
| `installSdk()` / `startVM()` / `stopVM()` | No-ops (uses host Claude Code) |

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
10. **Transcript persistence**: `CLAUDE_CONFIG_DIR` must point to the desktop app's session `.claude` dir (from `additionalMounts`), not a temp dir — otherwise transcripts are lost on restart
11. **Nested mounts**: `additionalMounts` may contain nested entries (e.g., `.claude` and `.claude/skills`). Sort by depth and skip children when parent is already symlinked.

## Next Steps

1. Add `getAppInfoForFile` to native stub for file preview "Open with" functionality
2. Implement bubblewrap sandboxing for Claude Code processes (requires Nix store bind-mounts)
3. Implement `cowork-plugin-shim.sh` for plugin permission bridge
4. Add `getWindowsElevationType` to native stub to suppress error log

---

**Last Updated**: 2026-04-09
**Claude Desktop Version**: 1.1348.0
**Status**: Cowork fully functional — sessions, file ops, directory picker, MCP servers, transcript persistence all working on Linux.

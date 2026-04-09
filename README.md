# Claude Cowork Nix

[![Nix Flake](https://img.shields.io/badge/Nix-Flake-5277C3?logo=nixos&logoColor=white)](https://github.com/Reginleif88/claude-cowork-nix)
[![Platform](https://img.shields.io/badge/Platform-Linux-blue?logo=linux&logoColor=white)](https://github.com/Reginleif88/claude-cowork-nix)
[![License](https://img.shields.io/badge/License-Apache--2.0%20OR%20MIT-blue)](./LICENSE-APACHE)
[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-v1.1348.0-d97757)](https://claude.ai)
[![Cowork](https://img.shields.io/badge/Cowork-Enabled-green)](./COWORK_PROGRESS.md)

Fully declarative NixOS package for Claude Desktop on Linux with Cowork support. Extracts from the macOS DMG, patches for Linux compatibility, and wraps with Electron 41.

> Originally created by [Tom Cassady (@heytcass)](https://github.com/heytcass).
> Based on [claude-desktop-linux-flake](https://github.com/heytcass/claude-desktop-linux-flake).
> Codebase maintained with [Claude Code](https://claude.ai/code).
>
> **This is not an official Anthropic product.** Claude Desktop is property of Anthropic.

## Prerequisites

Nix with flakes enabled:

```bash
# NixOS users: already have Nix
# Others: install Nix
sh <(curl -L https://nixos.org/nix/install) --daemon

# Enable flakes (add to ~/.config/nix/nix.conf)
experimental-features = nix-command flakes
```

## Quick Start

```bash
# Run directly
nix run github:Reginleif88/claude-cowork-nix

# Install to profile
nix profile install github:Reginleif88/claude-cowork-nix
```

### NixOS Module

```nix
# flake.nix
{
  inputs.claude-cowork-nix.url = "github:Reginleif88/claude-cowork-nix";

  outputs = { self, nixpkgs, claude-cowork-nix, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      modules = [
        claude-cowork-nix.nixosModules.default
        {
          programs.claude-desktop = {
            enable = true;
            fhs = true;   # Use FHS wrapper (default: true)
          };
        }
      ];
    };
  };
}
```

### Home Manager Module

```nix
{
  imports = [ claude-cowork-nix.homeManagerModules.default ];
  programs.claude-desktop = {
    enable = true;
    fhs = true;               # FHS wrapper (default: true)
    createDesktopEntry = true; # XDG desktop entry (default: true)
  };
}
```

## Package Variants

| Package | Description |
|---------|-------------|
| `default` | FHS-wrapped Claude Desktop with Cowork, MCP, and `/sessions` path support |
| `claude-app` | Just the patched app.asar (for custom wrappers) |
| `asar-tool` | Python ASAR extract/pack tool (development) |

The default package wraps Claude in a `buildFHSEnv` environment with `/usr/bin/bwrap`, `/usr/bin/node`, `/usr/bin/python3`, standard library paths, common tools (git, curl, docker-client, coreutils), and a `/sessions` symlink for Cowork VM path resolution.

## What Works

- **Sign-in** via Google OAuth / SSO (opens system browser, returns via deep link)
- **Native Wayland** support (not XWayland) via `--ozone-platform-hint=auto`
- **Persistent auth tokens** via `--password-store=gnome-libsecret` (works with KDE Wallet, GNOME Keyring, or any `org.freedesktop.secrets` provider)
- **HiDPI scaling** (sharp rendering)
- **Window decorations** with titlebar overlay
- **Claude Code** tool execution
- **File uploads and downloads**
- **Full chat** functionality
- **Cowork** sessions with Claude Code — multi-turn, file ops, directory picker, transcript persistence (see [COWORK_PROGRESS.md](./COWORK_PROGRESS.md))

## Architecture

```
macOS DMG (fetchurl)
       |
  7zz (LZFSE) -> app.asar
       |
  asar_tool.py extract -> raw JS
       |
  10 patches:
    00: Native module stub (@ant/claude-native + AuthRequest)
    01: Cowork module loader (claude-cowork-linux)
    02: Platform flag (route Linux through TypeScript VM path)
    03: Availability check (return "supported" for Linux)
    04: Skip bundle download (short-circuit on Linux)
    05: VM start intercept (Linux session with spawn, writeStdin, mounts)
    06: VM getter override (return Linux VM instance)
    07: Platform branding ("for Linux" in UI)
    08: Tray icon (theme-aware PNGs for Linux)
    09: DBus tray cleanup delay (stability fix)
       |
  asar_tool.py pack -> patched app.asar
       |
  electron_41 + makeWrapper + buildFHSEnv -> claude-desktop
```

Claude Desktop has two VM paths: macOS via `@ant/claude-swift` (Swift native module) and Windows via a TypeScript VM client over IPC sockets. By setting the platform flag (patch 02), Linux routes through the TypeScript path. The VM start function (patch 05) creates a Linux session that spawns Claude Code directly on the host, translates VM-internal paths to real host paths, and manages process I/O via the SDK wire protocol.

## Project Structure

```
.
├── flake.nix                         # Full NixOS package definition
├── modules/
│   ├── claude-cowork-linux.js        # Cowork session manager
│   └── enhanced-claude-native-stub.js # Linux native module replacement
├── scripts/
│   ├── branding-fix.js               # Platform branding patch
│   ├── cowork-init.js                # Cowork initialization
│   └── patch-vm-start.js             # VM start intercept (spawn, writeStdin, mounts)
├── tools/
│   ├── asar_tool.py                  # ASAR archive extract/pack
│   └── icns_extract.py               # macOS icon extraction
└── examples/                         # NixOS/Home Manager config examples
```

## Development

```bash
# Enter dev shell with all tools
nix develop

# Build and test
nix build .
nix flake check                 # Validate structure

# Launch and check logs
nix run . 2>&1 | grep -E "Cowork|error"
```

### Updating to New Versions

Patches use `perl -pe` regex with `\w+` wildcards for minified identifiers, so version bumps should not require patch changes.

1. Get the new DMG URL from `https://claude.ai/download` (inspect the download link in browser dev tools)
2. Update `claudeVersion`, `claudeDmgUrl`, and `claudeDmgHash` in `flake.nix` (use `nix-prefetch-url <url>` then `nix hash convert --hash-algo sha256 --to sri <hash>`)
3. Build: `nix build .` -- if it succeeds, patches are still valid
4. If build fails: check the `grep -qP` verification errors to see which regex needs updating

## Troubleshooting

### Build Fails at DMG Extraction

The build uses `7zz` which supports LZFSE-compressed DMGs natively. If extraction fails, check if the DMG URL is still valid by downloading it in a browser from `https://claude.ai/download`.

### Wayland Issues

The wrapper passes `--ozone-platform-hint=auto`. To force Wayland:

```bash
claude-desktop --ozone-platform=wayland
```

### Cowork Not Appearing

```bash
nix build . -L 2>&1 | grep -E "patch|applied|WARNING|ERROR"
```

All patches should show "applied" with no "WARNING" lines.

### Bubblewrap Permission Errors

On some systems, user namespaces may be restricted:

```bash
sysctl kernel.unprivileged_userns_clone
# Should be 1. If 0:
sudo sysctl kernel.unprivileged_userns_clone=1
```

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT License](LICENSE-MIT), at your option.

Claude Desktop itself is property of Anthropic. This project provides only the packaging and patching code.

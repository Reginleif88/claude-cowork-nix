# Example Home Manager configuration with Claude Desktop
# Add this to your home.nix

{ config, pkgs, ... }:

{
  # Import the Claude Desktop Home Manager module
  # (Assumes you've added it to your flake inputs as "claude-cowork-nix")
  imports = [
    inputs.claude-cowork-nix.homeManagerModules.default
  ];

  programs.claude-desktop = {
    enable = true;
    fhs = true;               # FHS wrapper (recommended for Cowork + MCP)
    createDesktopEntry = true; # Creates XDG desktop launcher
  };
}

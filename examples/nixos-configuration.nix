# Example NixOS configuration with Claude Desktop
# Add this to your /etc/nixos/configuration.nix

{ config, pkgs, ... }:

{
  # Import the Claude Desktop flake module
  # (Assumes you've added it to your flake inputs as "claude-cowork-nix")
  imports = [
    inputs.claude-cowork-nix.nixosModules.default
  ];

  programs.claude-desktop = {
    enable = true;
    fhs = true;  # Use FHS wrapper (recommended for Cowork + MCP)
  };
}

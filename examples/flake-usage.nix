# Example flake.nix that uses claude-cowork-nix
# This shows how to integrate Claude Desktop into your system flake

{
  description = "My NixOS configuration with Claude Desktop";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    claude-cowork-nix = {
      url = "github:Reginleif88/claude-cowork-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, claude-cowork-nix, home-manager, ... }@inputs: {
    # NixOS system configuration
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      specialArgs = { inherit inputs; };
      modules = [
        ./hardware-configuration.nix

        claude-cowork-nix.nixosModules.default

        {
          programs.claude-desktop = {
            enable = true;
            fhs = true;  # FHS wrapper for Cowork + MCP compatibility
          };
        }
      ];
    };

    # Home Manager configuration
    homeConfigurations.myuser = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      extraSpecialArgs = { inherit inputs; };
      modules = [
        claude-cowork-nix.homeManagerModules.default

        {
          programs.claude-desktop = {
            enable = true;
            fhs = true;
            createDesktopEntry = true;
          };
        }
      ];
    };
  };
}

let
  pkgs = import <nixpkgs> {};
  dockerTools = pkgs.dockerTools;
in
dockerTools.buildImage {
  name = "my-image";
  tag = "latest";
  contents = [ pkgs.nodejs-16_x ];  # Assuming you have Node.js 16 available in your Nixpkgs
  config.Cmd = [ "node" "main.js" ];
  config.User = "node";
  config.WorkingDir = "/app";
  config.Volumes = [
    "/app/data"  # Assuming you want to create a volume for the data directory
  ];
  config.Entrypoint = [ "/sbin/tini" "--" ];
}

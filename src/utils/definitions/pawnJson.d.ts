// Using same as sampctl, see https://github.com/Southclaws/sampctl/wiki/Package-Definition-Reference
interface PawnJsonDef {
  // General info
  user: string;
  repo: string;
  contributors?: string[];
  website?: string;

  // Compile options
  entry: string;
  output: string;
  local: boolean;
  dependencies: string[];
  dev_dependencies: string[];
  build: {
    args: string[];
    compiler: {
      site: string;
      user: string;
      repo: string;
      version: string;
    };
  };
  builds?: {
    name: string;
    constants?: Record<string, unknown>;
  }[];
  include_path?: string;

  runtime?: {
    mode: string;
  };
  runtimes?: {
    name: string;
    port: number;
  }[];
}

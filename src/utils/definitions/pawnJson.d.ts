// Using same as sampctl, see https://github.com/Southclaws/sampctl/wiki/Package-Definition-Reference
// Extended from sampctl Package struct for full compatibility
interface PawnJsonDef {
  // Repository metadata (for packages published to GitHub)
  user?: string;
  repo?: string;
  site?: string;
  path?: string;
  tag?: string;
  branch?: string;
  commit?: string;
  
  // Package metadata
  contributors?: string[];
  website?: string;

  // Build configuration
  entry?: string;
  output?: string;
  local?: boolean;
  dependencies?: string[];
  dev_dependencies?: string[];
  include_path?: string;
  resources?: Array<{
    name: string;
    platform?: string;
    archive?: boolean;
    plugins?: string[];
  }>;
  
  // Build configurations
  build?: {
    name?: string;
    version?: string;
    workingDir?: string;
    args?: string[];
    input?: string;
    output?: string;
    includes?: string[];
    constants?: Record<string, string>;
    plugins?: string[][];
    compiler?: {
      site?: string;
      user?: string;
      repo?: string;
      version?: string;
      path?: string;
    };
    prebuild?: string[][];
    postbuild?: string[][];
  };
  builds?: Array<{
    name: string;
    version?: string;
    workingDir?: string;
    args?: string[];
    input?: string;
    output?: string;
    includes?: string[];
    constants?: Record<string, string>;
    plugins?: string[][];
    compiler?: {
      site?: string;
      user?: string;
      repo?: string;
      version?: string;
      path?: string;
    };
    prebuild?: string[][];
    postbuild?: string[][];
  }>;

  // Runtime configurations
  runtime?: {
    name?: string;
    version?: string;
    mode?: string;
    runtime_type?: string;
    rootLink?: boolean;
    echo?: string;
    
    // Core server properties
    gamemodes?: string[];
    filterscripts?: string[];
    plugins?: Array<string | { name: string; [key: string]: unknown }>;
    rcon_password?: string;
    port?: number;
    hostname?: string;
    maxplayers?: number;
    language?: string;
    mapname?: string;
    weburl?: string;
    gamemodetext?: string;
    
    // Advanced server settings
    announce?: boolean;
    query?: boolean;
    chatlogging?: boolean;
    weblogging?: boolean;
    onfoot_rate?: number;
    incar_rate?: number;
    weapon_rate?: number;
    stream_distance?: number;
    stream_rate?: number;
    maxnpc?: number;
    logtimeformat?: string;
    password?: string;
    
    // Legacy SA-MP settings
    lagcompmode?: number;
    sleep?: number;
    bind?: string;
  };
  runtimes?: Array<{
    name: string;
    version?: string;
    mode?: string;
    runtime_type?: string;
    port?: number;
    hostname?: string;
    maxplayers?: number;
    [key: string]: unknown;
  }>;
}

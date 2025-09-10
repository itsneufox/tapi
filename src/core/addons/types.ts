import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// Core addon interface
export interface PawnctlAddon {
  // Addon metadata
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  
  // Addon capabilities
  hooks: AddonHooks;
  commands?: AddonCommand[];
  dependencies?: string[];
  
  // Lifecycle
  activate?(context: AddonContext): Promise<void>;
  deactivate?(): Promise<void>;
}

// Hook definitions for different lifecycle events
export interface AddonHooks {
  // Build lifecycle
  preBuild?: (context: BuildContext) => Promise<void>;
  postBuild?: (context: BuildContext) => Promise<void>;
  
  // Package lifecycle
  preInstall?: (pkg: PackageInfo) => Promise<void>;
  postInstall?: (pkg: PackageInfo) => Promise<void>;
  preUninstall?: (pkg: PackageInfo) => Promise<void>;
  postUninstall?: (pkg: PackageInfo) => Promise<void>;
  
  // Server lifecycle
  preStart?: (config: ServerConfig) => Promise<void>;
  postStart?: (config: ServerConfig) => Promise<void>;
  preStop?: () => Promise<void>;
  postStop?: () => Promise<void>;
  
  // Project lifecycle
  preInit?: (project: ProjectInfo) => Promise<void>;
  postInit?: (project: ProjectInfo) => Promise<void>;
  
  // Custom events
  onEvent?: (event: string, data: unknown) => Promise<void>;
}

// Custom commands that addons can register
export interface AddonCommand {
  name: string;
  description: string;
  handler: (args: string[], options: Record<string, unknown>) => Promise<void>;
  options?: CommandOption[];
}

export interface CommandOption {
  name: string;
  description: string;
  required?: boolean;
  default?: unknown;
}

// Context provided to addons
export interface AddonContext {
  logger: typeof logger;
  config: Record<string, unknown>; // Will be typed properly when we integrate with config system
  events: EventEmitter;
  api: PawnctlAPI;
}

// API that addons can use to interact with pawnctl
export interface PawnctlAPI {
  // File operations
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  
  // Package operations
  installPackage: (packageName: string) => Promise<void>;
  uninstallPackage: (packageName: string) => Promise<void>;
  
  // Build operations
  build: (input: string, options?: Record<string, unknown>) => Promise<void>;
  
  // Server operations
  startServer: (config?: Record<string, unknown>) => Promise<void>;
  stopServer: () => Promise<void>;
  
  // Utility functions
  getProjectRoot: () => string;
  getConfig: () => Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
}

// Context types for different lifecycle events
export interface BuildContext {
  input: string;
  output: string;
  options: Record<string, unknown>;
  success: boolean;
  errors?: string[];
}

export interface PackageInfo {
  name: string;
  version: string;
  source: string;
  dependencies: string[];
}

export interface ServerConfig {
  port: number;
  maxPlayers: number;
  hostname: string;
  gamemode: string;
  [key: string]: unknown;
}

export interface ProjectInfo {
  name: string;
  type: 'gamemode' | 'filterscript' | 'library';
  path: string;
  config: Record<string, unknown>;
}

// Addon installation info
export interface AddonInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  installed: boolean;
  enabled: boolean;
  path?: string;
  dependencies: string[];
}

// Addon registry entry
export interface AddonRegistryEntry {
  addon: PawnctlAddon;
  info: AddonInfo;
  instance?: unknown;
}

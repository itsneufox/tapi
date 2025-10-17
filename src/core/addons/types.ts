import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// Core addon interface
export interface TapiAddon {
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
  dependencyConstraints?: Record<string, string>; // name -> version constraint
  
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
  
  // Manifest lifecycle
  preManifestLoad?: (manifestPath: string) => Promise<void>;
  postManifestLoad?: (manifest: ManifestContext) => Promise<void>;
  preManifestSave?: (manifest: ManifestContext) => Promise<void>;
  postManifestSave?: (manifestPath: string) => Promise<void>;
  onManifestChange?: (manifest: ManifestContext) => Promise<void>;
  
  // Custom events
  onEvent?: (event: string, data: unknown) => Promise<void>;
}

// Custom commands that addons can register
export interface AddonCommand {
  name: string;
  description: string;
  handler: (args: string[], options: Record<string, unknown>) => Promise<void>;
  options?: CommandOption[];
  override?: boolean; // Allow overriding built-in commands
  priority?: number; // Command priority (higher = executed first, default: 0)
}

export interface CommandOption {
  name: string;
  description: string;
  required?: boolean;
  default?: unknown;
}

// Command resolution and chaining
export interface CommandContext {
  originalCommand?: () => Promise<void>; // Reference to original command handler
  args: string[];
  options: Record<string, unknown>;
  program: unknown; // Commander program instance
}

export interface CommandResolver {
  registerCommand: (command: AddonCommand) => void;
  resolveCommand: (commandName: string) => AddonCommand | null;
  getOriginalCommand: (commandName: string) => (() => Promise<void>) | null;
}

// Context provided to addons
export interface AddonContext {
  logger: typeof logger;
  config: Record<string, unknown>; // Will be typed properly when we integrate with config system
  events: EventEmitter;
  api: TapiAPI;
}

// API that addons can use to interact with tapi
export interface TapiAPI {
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
  
  // Command operations
  registerCommand: (command: AddonCommand) => void;
  callOriginalCommand: (commandName: string, args: string[], options: Record<string, unknown>) => Promise<void>;
  
  // Manifest operations
  loadManifest: () => Promise<ManifestContext>;
  saveManifest: (manifest: ManifestContext) => Promise<void>;
  modifyManifest: (modifier: (manifest: Record<string, unknown>) => void) => Promise<void>;
  addManifestField: (path: string, value: unknown) => Promise<void>;
  removeManifestField: (path: string) => Promise<void>;
  getManifestField: (path: string) => unknown;
  setManifestField: (path: string, value: unknown) => Promise<void>;
  
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

// Manifest context for addon manipulation
export interface ManifestContext {
  manifest: Record<string, unknown>; // The actual pawn.json content
  path: string; // Path to the manifest file
  modified: boolean; // Whether the manifest has been modified
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
  dependencyConstraints?: Record<string, string>; // name -> version constraint
  source?: 'github' | 'local' | 'npm';
  githubUrl?: string;
  lastError?: string;
  lastErrorTime?: string;
}

// Addon registry entry
export interface AddonRegistryEntry {
  addon: TapiAddon;
  info: AddonInfo;
  instance?: unknown;
}

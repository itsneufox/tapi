import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { HookManager } from './hooks';
import { CommandResolver } from './commandResolver';
import { DependencyResolver } from './dependencyResolver';
import { AddonDiscovery } from './AddonDiscovery';
import { GitHubDownloader } from './GitHubDownloader';
import { AddonRegistry } from './AddonRegistry';
import { AddonInstaller } from './AddonInstaller';
import { AddonRecovery } from './AddonRecovery';
import { TapiAPI, AddonInfo, AddonCommand } from './types';
import { PackageManifest } from '../../core/manifest';
import { Command } from 'commander';

const _execAsync = promisify(exec);

/**
 * Central orchestrator that discovers, loads, installs, and manages tapi addons.
 */
export class AddonManager {
  private loader: AddonLoader;
  private hookManager: HookManager;
  private commandResolver: CommandResolver;
  private dependencyResolver: DependencyResolver;
  private discovery: AddonDiscovery;
  private github: GitHubDownloader;
  private registry: AddonRegistry;
  private installer: AddonInstaller;
  private recovery: AddonRecovery;
  private addonsDir: string;
  private globalAddonsDir: string;
  private registryFile: string;
  private api: TapiAPI;
  private addonsLoaded: boolean = false;
  
  constructor(program?: unknown) {
    // For packaged executables, use a different addon directory structure
    if (this.isPackagedExecutable()) {
      // Use a global addons directory for packaged executables
      this.addonsDir = path.join(require('os').homedir(), '.tapi', 'addons');
      this.globalAddonsDir = this.addonsDir;
    } else {
      // For development, use project-local addons
      this.addonsDir = path.join(process.cwd(), '.tapi', 'addons');
      this.globalAddonsDir = path.join(require('os').homedir(), '.tapi', 'addons');
    }
    
    this.registryFile = path.join(require('os').homedir(), '.tapi', 'addons.json');
    
    // Initialize command resolver
    this.commandResolver = new CommandResolver(program as Command);
    
    // Initialize API (will be properly implemented later)
    this.api = this.createAPI();
    
    this.loader = new AddonLoader(this.addonsDir, this.api);
    this.hookManager = new HookManager();
    this.dependencyResolver = new DependencyResolver(this);
    this.discovery = new AddonDiscovery(this.loader);
    this.github = new GitHubDownloader();
    this.registry = new AddonRegistry(this.registryFile, this.loader);
    this.recovery = new AddonRecovery(this.registry);
    this.installer = new AddonInstaller(
      this.loader,
      this.hookManager,
      this.registry,
      this.github,
      this.addonsDir,
      this.globalAddonsDir
    );
    
    // Addons will be loaded on first use via ensureAddonsLoaded()
  }
  
  private async initializeAddons(): Promise<void> {
    if (this.addonsLoaded) {
      return; // Already loaded
    }
    
    try {
      // Load from registry
      const { loaded: _loaded, failed } = await this.registry.loadFromRegistry();

      // Attempt automated recovery for failed addons
      for (const name of failed) {
        const msg = 'Failed to load from registry';
        this.recovery.recordAddonError(name, msg);
        await this.recovery.attemptAddonRecovery(name, msg);
      }

      const addons = this.loader.getAllAddons();
      this.hookManager.registerAddons(addons);

      // Register addon commands
      this.registerAddonCommands();

      this.addonsLoaded = true;
      if (addons.length > 0) {
        logger.detail(`📦 Loaded ${addons.length} addon${addons.length === 1 ? '' : 's'}`);
      }
    } catch (_error) {
      logger.warn(`⚠️ Failed to initialize addons: ${_error instanceof Error ? _error.message : 'unknown error'}`);
    }
  }
  
  /**
   * Check if we're running from a packaged executable
   */
  private isPackagedExecutable(): boolean {
    // Check if we're running from a packaged executable
    // First check for pkg property (most reliable)
    if ((process as unknown as Record<string, unknown>).pkg !== undefined) {
      return true;
    }
    
    // Check if executable path contains tapi
    if (process.execPath.includes('tapi')) {
      return true;
    }
    
    // For development, we can check for package.json
    try {
      return !fs.existsSync(path.join(__dirname, '../../package.json'));
    } catch {
      return true;
    }
  }

  // GitHub downloading is handled by GitHubDownloader
  
  /**
   * Ensure addons are loaded before operations
   */
  private async ensureAddonsLoaded(): Promise<void> {
    if (this.addonsLoaded) {
      return; // Already loaded
    }
    
    // First, discover addons in node_modules and global locations
    await this.discovery.discoverNodeModulesAddons(
      process.cwd(),
      this.globalAddonsDir,
      this.isPackagedExecutable()
    );

    // Register discovered addons with hook manager
    this.hookManager.registerAddons(this.loader.getAllAddons());

    // Then load from registry
    await this.initializeAddons();
  }
  
  
  private async saveToRegistry(): Promise<void> {
    try {
      await this.registry.saveToRegistry();
    } catch (error) {
      logger.warn(`⚠️ Failed to save addon registry: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  
  private createAPI(): TapiAPI {
    return {
      readFile: async (filePath: string) => {
        return fs.promises.readFile(filePath, 'utf8');
      },
      writeFile: async (filePath: string, content: string) => {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        return fs.promises.writeFile(filePath, content, 'utf8');
      },
      exists: async (filePath: string) => {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      installPackage: async (packageName: string) => {
        logger.info(`📦 Installing package: ${packageName}`);
        try {
          await this.installAddon(packageName);
          logger.info(`✅ Successfully installed package: ${packageName}`);
        } catch (error) {
          logger.error(`❌ Failed to install package ${packageName}: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error;
        }
      },
      uninstallPackage: async (packageName: string) => {
        logger.info(`🗑️ Uninstalling package: ${packageName}`);
        try {
          await this.uninstallAddon(packageName);
          logger.info(`✅ Successfully uninstalled package: ${packageName}`);
        } catch (error) {
          logger.error(`❌ Failed to uninstall package ${packageName}: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error;
        }
      },
      build: async (input: string, options?: Record<string, unknown>) => {
        logger.info(`🔨 Building: ${input}`);
        try {
          const { spawn } = await import('child_process');
          const path = await import('path');
          const fs = await import('fs');
          const manifestPath = path.join(process.cwd(), 'pawn.json');
          if (!fs.existsSync(manifestPath)) {
            throw new Error('No pawn.json found. Run "tapi init" first.');
          }
          
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent) as PackageManifest;
          
          if (!manifest.compiler) {
            throw new Error('No compiler configuration found in pawn.json');
          }
          
          let compilerConfig = manifest.compiler;
          if (options?.profile && manifest.compiler.profiles?.[options.profile as string]) {
            const profile = manifest.compiler.profiles[options.profile as string];
            compilerConfig = {
              ...compilerConfig,
              input: profile.input || compilerConfig.input,
              output: profile.output || compilerConfig.output,
              includes: profile.includes || compilerConfig.includes,
              options: profile.options || compilerConfig.options,
            };
          }
          
          const inputFile = input || compilerConfig.input;
          const outputFile = compilerConfig.output;
          const includes = compilerConfig.includes || [];
          const compilerOptions = compilerConfig.options || [];
          
          const compilerPath = this.findCompilerExecutable();
          if (!compilerPath) {
            throw new Error('PAWN compiler not found. Run "tapi init" to install it.');
          }
          
          const args = [
            `-i${inputFile}`,
            `-o${outputFile}`,
            ...includes.map((inc: string) => `-i${inc}`),
            ...compilerOptions,
            inputFile
          ];
          
          logger.info(`Running: ${compilerPath} ${args.join(' ')}`);
          
          const compiler = spawn(compilerPath, args, { stdio: 'inherit' });
          
          return new Promise<void>((resolve, reject) => {
            compiler.on('close', (code) => {
              if (code === 0) {
                logger.info(`✅ Build successful: ${outputFile}`);
                resolve();
              } else {
                reject(new Error(`Build failed with exit code ${code}`));
              }
            });
            
            compiler.on('error', (error) => {
              reject(new Error(`Failed to start compiler: ${error.message}`));
            });
          });
          
        } catch (error) {
          logger.error(`❌ Build failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error;
        }
      },
      startServer: async (config?: Record<string, unknown>): Promise<void> => {
        logger.info('🚀 Starting server...');
        try {
          const { spawn } = await import('child_process');
          const path = await import('path');
          const fs = await import('fs');
          const serverPath = this.findServerExecutable();
          if (!serverPath) {
            throw new Error('Server executable not found. Run "tapi init" to install it.');
          }
          
          let serverConfig = config;
          if (!serverConfig) {
            const configPath = path.join(process.cwd(), 'server.cfg');
            if (fs.existsSync(configPath)) {
              serverConfig = { config: configPath };
            }
          }
          
          const args = serverConfig ? Object.entries(serverConfig).map(([key, value]) => `-${key}=${value}`) : [];
          
          logger.info(`Running: ${serverPath} ${args.join(' ')}`);
          
          spawn(serverPath, args, { stdio: 'inherit' });
          
          logger.info('✅ Server started successfully');
          
        } catch (error) {
          logger.error(`❌ Failed to start server: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error;
        }
      },
      stopServer: async () => {
        logger.info('🛑 Stopping server...');
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const platform = process.platform;
          if (platform === 'win32') {
            await execAsync('taskkill /f /im samp-server.exe /t');
            await execAsync('taskkill /f /im open.mp-server.exe /t');
          } else {
            await execAsync('pkill -f samp-server');
            await execAsync('pkill -f open.mp-server');
          }
          
          logger.info('✅ Server stopped successfully');
        } catch (error) {
          logger.error(`❌ Failed to stop server: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error;
        }
      },
      registerCommand: (command) => {
        this.commandResolver.registerCommand(command);
      },
      callOriginalCommand: async (commandName: string, _args: string[], _options: Record<string, unknown>) => {
        const originalHandler = this.commandResolver.getOriginalCommand(commandName);
        if (originalHandler) {
          await originalHandler();
        } else {
          throw new Error(`Original command not found: ${commandName}`);
        }
      },
      // Manifest operations
      loadManifest: async () => {
        const manifestPath = path.join(process.cwd(), '.tapi', 'pawn.json');
        if (!fs.existsSync(manifestPath)) {
          throw new Error('No pawn.json manifest found');
        }

        // Call preManifestLoad hook
        try {
          await this.hookManager.executeHook('preManifestLoad', manifestPath);
        } catch (error) {
          const errorMsg = `preManifestLoad hook failed: ${error instanceof Error ? error.message : 'unknown error'}`;
          logger.detail(errorMsg);
          this.recordAddonError('system', errorMsg);
        }

        const content = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        const manifestContext = {
          manifest,
          path: manifestPath,
          modified: false
        };

        // Call postManifestLoad hook
        try {
          await this.hookManager.executeHook('postManifestLoad', manifestContext);
        } catch (error) {
          const errorMsg = `postManifestLoad hook failed: ${error instanceof Error ? error.message : 'unknown error'}`;
          logger.detail(errorMsg);
          this.recordAddonError('system', errorMsg);
        }

        return manifestContext;
      },
      saveManifest: async (manifestContext) => {
        // Call preManifestSave hook
        try {
          await this.hookManager.executeHook('preManifestSave', manifestContext);
        } catch (error) {
          logger.detail(`Addon preManifestSave hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        const content = JSON.stringify(manifestContext.manifest, null, 2);
        await fs.promises.writeFile(manifestContext.path, content, 'utf8');
        manifestContext.modified = false;

        // Call postManifestSave hook
        try {
          await this.hookManager.executeHook('postManifestSave', manifestContext.path);
        } catch (error) {
          logger.detail(`Addon postManifestSave hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      },
      modifyManifest: async (modifier) => {
        const manifestContext = await this.api.loadManifest();
        modifier(manifestContext.manifest);
        manifestContext.modified = true;
        await this.api.saveManifest(manifestContext);
      },
      addManifestField: async (fieldPath, value) => {
        await this.api.modifyManifest((manifest) => {
          const keys = fieldPath.split('.');
          let current = manifest;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]] as Record<string, unknown>;
          }
          current[keys[keys.length - 1]] = value;
        });
      },
      removeManifestField: async (fieldPath) => {
        await this.api.modifyManifest((manifest) => {
          const keys = fieldPath.split('.');
          let current = manifest;
          for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]] as Record<string, unknown>;
          }
          delete current[keys[keys.length - 1]];
        });
      },
      getManifestField: async (fieldPath) => {
        const manifestContext = await this.api.loadManifest();
        const keys = fieldPath.split('.');
        let current = manifestContext.manifest;
        for (const key of keys) {
          current = current[key] as Record<string, unknown>;
          if (current === undefined) return undefined;
        }
        return current;
      },
      setManifestField: async (fieldPath, value) => {
        await this.api.addManifestField(fieldPath, value);
      },
      getProjectRoot: () => process.cwd(),
      getConfig: () => ({}), // Will integrate with config system
      setConfig: (_config: Record<string, unknown>) => {
        // Will integrate with config system
      }
    };
  }
  
  /**
   * Install an addon with optional automatic dependency installation
   */
  async installAddon(addonName: string, options: Record<string, unknown> = {}): Promise<void> {
    const autoDeps = options.autoDeps || false;
    try {
      // Install the requested addon via installer
      await this.installer.installAddon(addonName, {
        source: (options.source as 'github' | 'local' | undefined),
        path: (options.path as string | undefined),
        global: Boolean(options.global),
      });

      // Optionally handle dependencies after main install
      if (autoDeps) {
        logger.info('🔄 Checking and installing dependencies automatically...');
        try {
          const resolution = await this.resolveDependencies(addonName);
          if (resolution.missing.length > 0) {
            logger.info(
              `📋 Found ${resolution.missing.length} missing dependencies: ${resolution.missing.join(', ')}`
            );
            const autoInstallResult = await this.dependencyResolver.autoInstallDependencies(
              resolution,
              options
            );
            if (autoInstallResult.installed.length > 0) {
              logger.success(
                `✅ Auto-installed ${autoInstallResult.installed.length} dependencies: ${autoInstallResult.installed.join(', ')}`
              );
            }
            if (autoInstallResult.failed.length > 0) {
              logger.warn(
                `⚠️ Failed to auto-install ${autoInstallResult.failed.length} dependencies: ${autoInstallResult.failed.join(', ')}`
              );
            }
          } else {
            logger.info('✅ All dependencies already satisfied');
          }
        } catch (error) {
          logger.warn(
            `⚠️ Auto-dependency installation failed: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    } catch (error) {
      logger.error(
        `❌ Failed to install addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      throw error;
    }
  }
  
  /**
   * Uninstall an addon
   */
  async uninstallAddon(addonName: string, _options: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.installer.uninstallAddon(addonName, Boolean(_options.global));
    } catch (_error) {
      logger.error(
        `❌ Failed to uninstall addon ${addonName}: ${_error instanceof Error ? _error.message : 'unknown error'}`
      );
      throw _error;
    }
  }
  
  /**
   * List installed addons
   */
  async listAddons(_options: Record<string, unknown> = {}): Promise<AddonInfo[]> {
    const _isGlobal = _options.global || false;
    const _showEnabled = _options.enabled || false;
    const _showDisabled = _options.disabled || false;
    
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      const addons = this.loader.getAllAddons();
      const addonInfos: AddonInfo[] = [];
      
      for (const addon of addons) {
        const addonInfo = this.loader.getAddonInfo(addon.name);
        if (addonInfo) {
          addonInfos.push(addonInfo);
        }
      }
      
      return addonInfos;
      
    } catch (error) {
      logger.error(`❌ Failed to list addons: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Enable an addon
   */
  async enableAddon(addonName: string): Promise<void> {
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      const addon = this.loader.getAddon(addonName);
      if (!addon) {
        throw new Error(`Addon not found: ${addonName}`);
      }
      
      // Addon is already loaded, just need to register hooks
      this.hookManager.registerAddons([addon]);
      
      logger.success(`✅ Enabled addon: ${addonName}`);
      
    } catch (error) {
      logger.error(`❌ Failed to enable addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Disable an addon
   */
  async disableAddon(addonName: string): Promise<void> {
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      await this.loader.unloadAddon(addonName);
      
      logger.success(`✅ Disabled addon: ${addonName}`);
      
    } catch (error) {
      logger.error(`❌ Failed to disable addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Search for addons
   */
  async searchAddons(query: string, _limit: number = 10): Promise<AddonInfo[]> {
    try {
      logger.detail(`🔍 Searching for addons: "${query}"`);
      
      const allAddons = this.loader.getAllAddons();
      const searchResults: AddonInfo[] = [];
      
      // Search persisted registry first
      const registryData = await this.registry.getRawData();
      const registryAddons = (registryData?.addons as AddonInfo[] | undefined) || [];
      for (const addon of registryAddons) {
        if (this.matchesSearchQuery(addon, query)) {
          searchResults.push(addon);
        }
      }
      
      for (const addon of allAddons) {
        const addonInfo: AddonInfo = {
          name: addon.name,
          version: addon.version,
          description: addon.description,
          author: addon.author,
          license: addon.license,
          path: '',
          installed: true,
          enabled: true,
          dependencies: []
        };
        
        if (this.matchesSearchQuery(addonInfo, query) && !searchResults.find(result => result.name === addon.name)) {
          searchResults.push(addonInfo);
        }
      }
      
      const nodeModulesAddons = await this.discovery.searchNodeModulesAddons(
        query,
        process.cwd(),
        this.globalAddonsDir
      );
      for (const addon of nodeModulesAddons) {
        if (!searchResults.find(result => result.name === addon.name)) {
          searchResults.push(addon);
        }
      }
      
      logger.detail(`Found ${searchResults.length} addon(s) matching "${query}"`);
      return searchResults.slice(0, _limit);
      
    } catch (error) {
      logger.error(`❌ Failed to search addons: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Check if an addon matches the search query
   */
  private matchesSearchQuery(addon: AddonInfo, query: string): boolean {
    if (!query || query.trim() === '') {
      return true;
    }
    
    const searchTerm = query.toLowerCase().trim();
    const addonName = addon.name.toLowerCase();
    const addonDescription = (addon.description || '').toLowerCase();
    const addonAuthor = (addon.author || '').toLowerCase();
    
    return addonName.includes(searchTerm) || 
           addonDescription.includes(searchTerm) || 
           addonAuthor.includes(searchTerm);
  }

  // Node_modules search moved to AddonDiscovery

  /**
   * Show addon information
   */
  async showAddonInfo(addonName: string): Promise<void> {
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      const addonInfo = this.loader.getAddonInfo(addonName);
      if (!addonInfo) {
        throw new Error(`Addon not found: ${addonName}`);
      }
      
      logger.info(`📦 Addon: ${addonInfo.name}`);
      logger.info(`   Version: ${addonInfo.version}`);
      logger.info(`   Description: ${addonInfo.description}`);
      logger.info(`   Author: ${addonInfo.author}`);
      logger.info(`   License: ${addonInfo.license}`);
      logger.info(`   Status: ${addonInfo.enabled ? '✅ enabled' : '❌ disabled'}`);
      
      if (addonInfo.dependencies.length > 0) {
        logger.info(`   Dependencies: ${addonInfo.dependencies.join(', ')}`);
      }
      
      // Show hooks
      const hooks = this.hookManager.getAddonHooks(addonName);
      if (hooks.length > 0) {
        logger.info(`   Hooks: ${hooks.join(', ')}`);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to get addon info for ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Update an addon
   */
  async updateAddon(addonName: string): Promise<void> {
    try {
      await this.ensureAddonsLoaded();
      await this.installer.updateGitHubAddon(addonName);
    } catch (error) {
      logger.error(`❌ Failed to update addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a GitHub-based addon
   */
  // updateGitHubAddon now handled by AddonInstaller
  
  /**
   * Update all addons
   */
  async updateAllAddons(): Promise<void> {
    try {
      await this.installer.updateAllGitHubAddons();
    } catch (error) {
      logger.error(`❌ Failed to update addons: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get hook manager for integration with other commands
   */
  getHookManager(): HookManager {
    return this.hookManager;
  }

  /**
   * Get dependency resolver
   */
  getDependencyResolver(): DependencyResolver {
    return this.dependencyResolver;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph() {
    return this.dependencyResolver.buildDependencyGraph();
  }

  /**
   * Resolve dependencies for an addon
   */
  async resolveDependencies(addonName: string): Promise<import('./dependencyResolver').DependencyResolution> {
    return this.dependencyResolver.resolveDependencies(addonName);
  }

  /**
   * Validate addon dependencies
   */
  validateDependencies(addonName: string): { valid: boolean; issues: string[] } {
    return this.dependencyResolver.validateDependencies(addonName);
  }
  
  /**
   * Get addon loader for integration with other commands
   */
  getLoader(): AddonLoader {
    return this.loader;
  }

  /**
   * Get command resolver for integration with other commands
   */
  getCommandResolver(): CommandResolver {
    return this.commandResolver;
  }

  /**
   * Record an error for a specific addon
   */
  private recordAddonError(addonName: string, error: string): void {
    this.recovery.recordAddonError(addonName, error);
  }

  /**
   * Get errors for a specific addon
   */
  getAddonErrors(addonName: string): string[] {
    return this.recovery.getAddonErrors(addonName);
  }

  /**
   * Clear errors for a specific addon
   */
  clearAddonErrors(addonName: string): void {
    this.recovery.clearAddonErrors(addonName);
  }

  /**
   * Get all addon errors
   */
  getAllAddonErrors(): Map<string, string[]> {
    return this.recovery.getAllAddonErrors();
  }

  /**
   * Register addon commands with the main program
   */
  registerAddonCommands(): void {
    try {
      this.commandResolver.registerAddonCommandsWithProgram();
      const stats = this.commandResolver.getStats();
      
      if (stats.totalAddonCommands > 0) {
        logger.info(`🔌 Registered ${stats.totalAddonCommands} addon commands`);
        
        if (stats.overriddenCommands.length > 0) {
          logger.info(`🔄 Overridden commands: ${stats.overriddenCommands.join(', ')}`);
        }
        
        if (stats.newCommands.length > 0) {
          logger.info(`➕ New commands: ${stats.newCommands.join(', ')}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Failed to register addon commands: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Get command conflict information
   */
  getCommandConflicts(): Map<string, AddonCommand[]> {
    return this.commandResolver?.getCommandConflicts() || new Map();
  }

  /**
   * Check if there are any command conflicts
   */
  hasCommandConflicts(): boolean {
    return this.commandResolver?.hasConflicts() || false;
  }

  /**
   * Get detailed conflict information for a specific command
   */
  getCommandConflictInfo(commandName: string): {
    hasConflict: boolean;
    conflictingAddons: AddonCommand[];
    currentAddon: AddonCommand | null;
  } {
    return this.commandResolver?.getCommandConflictInfo(commandName) || {
      hasConflict: false,
      conflictingAddons: [],
      currentAddon: null
    };
  }

  /**
   * Get command resolver statistics
   */
  getCommandStats(): {
    totalAddonCommands: number;
    overriddenCommands: string[];
    newCommands: string[];
    conflicts: number;
    conflictedCommands: string[];
  } {
    return this.commandResolver?.getStats() || {
      totalAddonCommands: 0,
      overriddenCommands: [],
      newCommands: [],
      conflicts: 0,
      conflictedCommands: []
    };
  }
  
  /**
   * Find PAWN compiler executable
   */
  private findCompilerExecutable(): string | null {
    const path = require('path');
    const fs = require('fs');
    
    // Common compiler locations
    const compilerPaths = [
      path.join(process.cwd(), 'qawno', 'pawncc.exe'),
      path.join(process.cwd(), 'qawno', 'pawncc'),
      path.join(process.cwd(), 'pawno', 'pawncc.exe'),
      path.join(process.cwd(), 'pawno', 'pawncc'),
      path.join(process.cwd(), 'compiler', 'pawncc.exe'),
      path.join(process.cwd(), 'compiler', 'pawncc'),
    ];
    
    // Check PATH
    const { execSync } = require('child_process');
    try {
      const result = execSync('where pawncc 2>nul || which pawncc 2>/dev/null', { encoding: 'utf8' });
      if (result.trim()) {
        return result.trim().split('\n')[0];
      }
    } catch {
      // Ignore errors, continue with file system search
    }
    
    // Check file system
    for (const compilerPath of compilerPaths) {
      if (fs.existsSync(compilerPath)) {
        return compilerPath;
      }
    }
    
    return null;
  }

  /**
   * Find server executable
   */
  private findServerExecutable(): string | null {
    const path = require('path');
    const fs = require('fs');
    
    // Common server locations
    const serverPaths = [
      path.join(process.cwd(), 'qawno', 'open.mp-server.exe'),
      path.join(process.cwd(), 'qawno', 'open.mp-server'),
      path.join(process.cwd(), 'samp', 'samp-server.exe'),
      path.join(process.cwd(), 'samp', 'samp-server'),
      path.join(process.cwd(), 'server', 'open.mp-server.exe'),
      path.join(process.cwd(), 'server', 'samp-server.exe'),
    ];
    
    // Check file system
    for (const serverPath of serverPaths) {
      if (fs.existsSync(serverPath)) {
        return serverPath;
      }
    }
    
    return null;
  }

  /**
   * Run an addon command
   */
  async runAddonCommand(commandName: string, args: string[] = [], options: Record<string, unknown> = {}): Promise<void> {
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      const addons = this.loader.getAllAddons();
      let commandFound = false;
      
      for (const addon of addons) {
        if (addon.commands) {
          for (const command of addon.commands) {
            if (command.name === commandName) {
              logger.detail(`🔌 Running addon command: ${commandName} from ${addon.name}`);
              await command.handler(args, options);
              commandFound = true;
              return;
            }
          }
        }
      }
      
      if (!commandFound) {
        throw new Error(`Addon command "${commandName}" not found`);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to run addon command ${commandName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
}

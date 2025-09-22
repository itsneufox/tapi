import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { HookManager } from './hooks';
import { CommandResolver } from './commandResolver';
import { DependencyResolver } from './dependencyResolver';
import { TapiAPI, AddonInfo, AddonCommand } from './types';
import { PackageManifest } from '../../core/manifest';
import { Command } from 'commander';

const _execAsync = promisify(exec);

export class AddonManager {
  private loader: AddonLoader;
  private hookManager: HookManager;
  private commandResolver: CommandResolver;
  private dependencyResolver: DependencyResolver;
  private addonsDir: string;
  private globalAddonsDir: string;
  private registryFile: string;
  private addonErrors: Map<string, string[]> = new Map();
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
    
    // Addons will be loaded on first use via ensureAddonsLoaded()
  }
  
  private async initializeAddons(): Promise<void> {
    if (this.addonsLoaded) {
      return; // Already loaded
    }
    
    try {
      // Load from registry (this handles both registry and directory loading)
      await this.loadFromRegistry();
      
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

  /**
   * Download a repository from GitHub
   */
  private async downloadGitHubRepo(username: string, repoName: string, targetPath: string): Promise<void> {
    const https = require('https');
    const { createWriteStream } = require('fs');
    
    // Create target directory
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    
    // Download the repository as a ZIP file
    const zipUrl = `https://github.com/${username}/${repoName}/archive/refs/heads/main.zip`;
    const zipPath = path.join(targetPath, 'repo.zip');
    
    logger.detail(`Downloading from: ${zipUrl}`);
    
    return new Promise((resolve, reject) => {
      const file = createWriteStream(zipPath);
      
      const downloadFile = (url: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        https.get(url, (response: any) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              logger.detail(`Following redirect to: ${redirectUrl}`);
              downloadFile(redirectUrl);
              return;
            }
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download repository: ${response.statusCode}`));
            return;
          }
          
          response.pipe(file);
          
          file.on('finish', async () => {
            file.close();
            
            try {
              // Extract the ZIP file
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(zipPath);
              
              // Extract to a temporary directory
              const tempDir = path.join(targetPath, 'temp');
              zip.extractAllTo(tempDir, true);
              
              // Find the extracted folder (it will be named repoName-main)
              const extractedDir = path.join(tempDir, `${repoName}-main`);
              if (fs.existsSync(extractedDir)) {
                // Move contents to target directory
                const files = fs.readdirSync(extractedDir);
                for (const file of files) {
                  const srcPath = path.join(extractedDir, file);
                  const destPath = path.join(targetPath, file);
                  fs.renameSync(srcPath, destPath);
                }
                
                // Clean up
                fs.rmSync(tempDir, { recursive: true, force: true });
                fs.unlinkSync(zipPath);
                
                logger.detail(`✅ Successfully downloaded and extracted ${username}/${repoName}`);
                resolve();
              } else {
                reject(new Error('Failed to extract repository'));
              }
            } catch (error) {
              reject(error);
            }
          });
          
          file.on('error', (error: Error) => {
            fs.unlinkSync(zipPath);
            reject(error);
          });
        }).on('error', (error: Error) => {
          reject(error);
        });
      };
      
      downloadFile(zipUrl);
    });
  }
  
  /**
   * Ensure addons are loaded before operations
   */
  private async ensureAddonsLoaded(): Promise<void> {
    if (this.addonsLoaded) {
      return; // Already loaded
    }
    
    // First, discover addons in node_modules
    await this.discoverNodeModulesAddons();
    
    // Then load from registry
    await this.initializeAddons();
  }
  
  /**
   * Discover addons in node_modules/tapi-* and global addon directory
   */
  private async discoverNodeModulesAddons(): Promise<void> {
    try {
      // Discover addons in project's node_modules
      await this.discoverAddonsInDirectory(path.join(process.cwd(), 'node_modules'), 'node_modules');

      // Discover addons in global addon directory (for packaged executables)
      if (this.isPackagedExecutable() && fs.existsSync(this.globalAddonsDir)) {
        await this.discoverAddonsInDirectory(this.globalAddonsDir, 'global');
      }

      // Register discovered addons with hook manager
      const discoveredAddons = this.loader.getAllAddons();
      this.hookManager.registerAddons(discoveredAddons);

    } catch (error) {
      logger.detail(`⚠️ Addon discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Discover addons in a specific directory
   */
  private async discoverAddonsInDirectory(dirPath: string, source: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return; // Directory doesn't exist
    }

    const dirContents = fs.readdirSync(dirPath);
    const tapiAddons = dirContents.filter(name => 
      name.startsWith('tapi-') && name !== 'tapi'
    );

    for (const addonName of tapiAddons) {
      const addonPath = path.join(dirPath, addonName);
      const packageJsonPath = path.join(addonPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        continue; // Skip if no package.json
      }

      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const tapiConfig = packageJson.tapi;
        
        if (!tapiConfig) {
          continue; // Skip if no tapi config
        }

        // Check if addon is already in registry
        const existingAddon = this.loader.getAddonInfo(tapiConfig.name);
        if (existingAddon) {
          continue; // Already registered
        }

        // Try to load the addon
        const mainFile = packageJson.main || 'index.js';
        const addonFilePath = path.join(addonPath, mainFile);
        
        if (fs.existsSync(addonFilePath)) {
          const addon = await this.loader.loadAddon(addonFilePath);
          const addonInfo = {
            name: tapiConfig.name,
            version: tapiConfig.version || packageJson.version,
            description: tapiConfig.description || packageJson.description,
            author: tapiConfig.author || packageJson.author,
            license: tapiConfig.license || packageJson.license,
            installed: true,
            enabled: true,
            path: addonPath,
            dependencies: tapiConfig.dependencies || []
          };

          this.loader.registerAddon(addon, addonInfo);
          logger.detail(`🔍 Discovered addon: ${addonInfo.name} from ${source}`);
        }
      } catch (error) {
        logger.detail(`⚠️ Failed to discover addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  }

  private async loadFromRegistry(): Promise<void> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return;
      }
      
      const registryData = JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
      const loadedAddons: string[] = [];
      const failedAddons: string[] = [];
      
      for (const addonInfo of registryData.addons || []) {
        if (addonInfo.path && fs.existsSync(addonInfo.path)) {
          try {
            const addon = await this.loader.loadAddon(addonInfo.path);
            this.loader.registerAddon(addon, addonInfo);
            loadedAddons.push(addonInfo.name);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'unknown error';
            logger.warn(`⚠️ Failed to load addon from registry: ${addonInfo.name} (${errorMsg})`);
            failedAddons.push(addonInfo.name);
            
            // Record the error for later analysis
            this.recordAddonError(addonInfo.name, errorMsg);
            
            // Try to recover by disabling the problematic addon
            await this.attemptAddonRecovery(addonInfo.name, errorMsg, registryData);
          }
        } else {
          logger.warn(`⚠️ Addon path not found: ${addonInfo.name} (${addonInfo.path})`);
          failedAddons.push(addonInfo.name);
        }
      }
      
      // Register loaded addons with hook manager
      const allLoadedAddons = this.loader.getAllAddons();
      this.hookManager.registerAddons(allLoadedAddons);
      
      // Report loading summary
      if (loadedAddons.length > 0) {
        logger.detail(`✅ Successfully loaded ${loadedAddons.length} addon(s): ${loadedAddons.join(', ')}`);
      }
      
      if (failedAddons.length > 0) {
        logger.warn(`⚠️ Failed to load ${failedAddons.length} addon(s): ${failedAddons.join(', ')}`);
        logger.info('💡 Run "tapi addon list" to see addon status and recovery suggestions');
      }
      
    } catch (error) {
      logger.warn(`⚠️ Failed to load addon registry: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Attempt to recover from addon loading errors
   */
  private async attemptAddonRecovery(addonName: string, errorMsg: string, registryData?: Record<string, unknown>): Promise<void> {
    try {
      if (!registryData) {
        const registryContent = await fs.promises.readFile(this.registryFile, 'utf8');
        registryData = JSON.parse(registryContent);
      }
      
      const addons = registryData?.addons as Record<string, unknown>[] | undefined;
      const addonIndex = addons?.findIndex((addon: Record<string, unknown>) => addon.name === addonName);
      if (addonIndex !== undefined && addonIndex >= 0 && addons) {
        addons[addonIndex].enabled = false;
        addons[addonIndex].lastError = errorMsg;
        addons[addonIndex].lastErrorTime = new Date().toISOString();
        
        await fs.promises.writeFile(this.registryFile, JSON.stringify(registryData, null, 2));
        logger.detail(`🔧 Automatically disabled problematic addon: ${addonName}`);
      }
    } catch (recoveryError) {
      logger.detail(`⚠️ Could not auto-disable addon ${addonName}: ${recoveryError instanceof Error ? recoveryError.message : 'unknown error'}`);
    }
  }
  
  private async saveToRegistry(): Promise<void> {
    try {
      const addons = this.loader.getAllAddons();
      const registryData = {
        addons: addons.map(addon => {
          const info = this.loader.getAddonInfo(addon.name);
          return info;
        }).filter(info => info !== undefined)
      };
      
      // Ensure directory exists
      const registryDir = path.dirname(this.registryFile);
      if (!fs.existsSync(registryDir)) {
        fs.mkdirSync(registryDir, { recursive: true });
      }
      
      fs.writeFileSync(this.registryFile, JSON.stringify(registryData, null, 2));
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
    const isGlobal = options.global || false;
    const _isDev = options.dev || false;
    const autoDeps = options.autoDeps || false;
    
    try {
      // Auto-install dependencies if requested
      if (autoDeps) {
        logger.info('🔄 Checking and installing dependencies automatically...');
        
        try {
          const resolution = await this.resolveDependencies(addonName);
          
          if (resolution.missing.length > 0) {
            logger.info(`📋 Found ${resolution.missing.length} missing dependencies: ${resolution.missing.join(', ')}`);
            
            const autoInstallResult = await this.dependencyResolver.autoInstallDependencies(resolution, options);
            
            if (autoInstallResult.installed.length > 0) {
              logger.success(`✅ Auto-installed ${autoInstallResult.installed.length} dependencies: ${autoInstallResult.installed.join(', ')}`);
            }
            
            if (autoInstallResult.failed.length > 0) {
              logger.warn(`⚠️ Failed to auto-install ${autoInstallResult.failed.length} dependencies: ${autoInstallResult.failed.join(', ')}`);
            }
          } else {
            logger.info('✅ All dependencies already satisfied');
          }
          
          // Check for conflicts after auto-installation
          if (resolution.conflicts.length > 0) {
            logger.warn('⚠️ Dependency conflicts remain:');
            for (const conflict of resolution.conflicts) {
              logger.warn(`  • ${conflict.addon}: ${conflict.reason}`);
            }
          }
          
        } catch (error) {
          logger.warn(`⚠️ Auto-dependency installation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          logger.info('💡 Continuing with manual installation...');
        }
      } else {
        // Check for dependency conflicts before installation
        const validation = this.validateDependencies(addonName);
        if (!validation.valid) {
          logger.warn('⚠️ Dependency issues detected:');
          for (const issue of validation.issues) {
            logger.warn(`  • ${issue}`);
          }
          logger.info('💡 Use --auto-deps flag to automatically install missing dependencies');
        }
      }
      
      const installDir = isGlobal ? this.globalAddonsDir : this.addonsDir;
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }
      
      const isLocalPath = addonName.startsWith('./') || addonName.startsWith('../') || path.isAbsolute(addonName);
      
      if (isLocalPath) {
        const resolvedPath = path.resolve(addonName);
        logger.detail(`Installing local addon from ${resolvedPath}`);
        
        const addon = await this.loader.loadAddon(resolvedPath);
        this.hookManager.registerAddons([addon]);
        this.loader.registerAddon(addon, {
          path: resolvedPath,
          installed: true,
          enabled: true
        });
        await this.saveToRegistry();
        
        logger.success(`✅ Installed local addon: ${addon.name}@${addon.version}`);
        return;
      }
      
      if (addonName.startsWith('https://github.com/')) {
        const match = addonName.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          throw new Error('Invalid GitHub URL format');
        }
        
        const [, username, repoName] = match;
        const addonPath = path.join(installDir, `${username}-${repoName}`);
        
        logger.detail(`Downloading addon from GitHub: ${username}/${repoName}`);
        await this.downloadGitHubRepo(username, repoName, addonPath);
        const addon = await this.loader.loadAddon(addonPath);
        this.hookManager.registerAddons([addon]);
        this.loader.registerAddon(addon, {
          path: addonPath,
          installed: true,
          enabled: true
        });
        await this.saveToRegistry();
        
        logger.success(`✅ Installed addon: ${addon.name}@${addon.version}`);
        return;
      }
      
      throw new Error(`Unsupported addon source: ${addonName}`);
      
    } catch (error) {
      logger.error(`❌ Failed to install addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Uninstall an addon
   */
  async uninstallAddon(addonName: string, _options: Record<string, unknown> = {}): Promise<void> {
    const isGlobal = _options.global || false;
    const installDir = isGlobal ? this.globalAddonsDir : this.addonsDir;
    
    try {
      await this.loader.unloadAddon(addonName);
      const addonPath = path.join(installDir, addonName);
      if (fs.existsSync(addonPath)) {
        await fs.promises.rm(addonPath, { recursive: true, force: true });
      }
      
      logger.success(`✅ Uninstalled addon: ${addonName}`);
      
    } catch (_error) {
      logger.error(`❌ Failed to uninstall addon ${addonName}: ${_error instanceof Error ? _error.message : 'unknown error'}`);
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
      if (fs.existsSync(this.registryFile)) {
        try {
          const registryContent = await fs.promises.readFile(this.registryFile, 'utf8');
          const registry = JSON.parse(registryContent);
          
          for (const addon of registry.addons || []) {
            if (this.matchesSearchQuery(addon, query)) {
              searchResults.push(addon);
            }
          }
        } catch (error) {
          logger.detail(`Could not read registry: ${error instanceof Error ? error.message : 'unknown error'}`);
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
      
      const nodeModulesAddons = await this.searchNodeModulesAddons(query);
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

  /**
   * Search for addons in node_modules
   */
  private async searchNodeModulesAddons(query: string): Promise<AddonInfo[]> {
    const results: AddonInfo[] = [];
    
    try {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        return results;
      }
      
      const entries = await fs.promises.readdir(nodeModulesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('tapi-')) {
          const addonPath = path.join(nodeModulesPath, entry.name);
          const packageJsonPath = path.join(addonPath, 'package.json');
          
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageContent = await fs.promises.readFile(packageJsonPath, 'utf8');
              const packageJson = JSON.parse(packageContent);
              
              if (packageJson.tapi) {
                const addonInfo: AddonInfo = {
                  name: packageJson.tapi.name || entry.name,
                  version: packageJson.tapi.version || packageJson.version || '1.0.0',
                  description: packageJson.tapi.description || packageJson.description || 'No description',
                  author: packageJson.tapi.author || packageJson.author || 'Unknown',
                  license: packageJson.tapi.license || packageJson.license || 'MIT',
                  path: addonPath,
                  installed: true,
                  enabled: true,
                  dependencies: packageJson.tapi.dependencies || []
                };
                
                if (this.matchesSearchQuery(addonInfo, query)) {
                  results.push(addonInfo);
                }
              }
            } catch (error) {
              logger.detail(`Could not read package.json for ${entry.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
          }
        }
      }
    } catch (error) {
      logger.detail(`Could not search node_modules: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    
    return results;
  }

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
      logger.info(`🔄 Updating addon: ${addonName}`);
      
      // Get addon info to determine source
      const addonInfo = this.loader.getAddonInfo(addonName);
      if (!addonInfo) {
        throw new Error(`Addon not found: ${addonName}`);
      }
      
      // Check if addon is from GitHub
      if (addonInfo.source === 'github') {
        await this.updateGitHubAddon(addonName, addonInfo);
      } else if (addonInfo.source === 'local') {
        logger.info('📁 Local addons cannot be updated automatically');
        logger.info('💡 Update the addon manually in its directory');
      } else {
        logger.info('❓ Unknown addon source - cannot update');
      }
      
    } catch (error) {
      logger.error(`❌ Failed to update addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a GitHub-based addon
   */
  private async updateGitHubAddon(addonName: string, addonInfo: AddonInfo): Promise<void> {
    try {
      // Parse GitHub URL to get username/repo
      const githubUrl = addonInfo.githubUrl || '';
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      
      if (!match) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const [, username, repoName] = match;
      
      logger.info(`📥 Downloading latest version from ${username}/${repoName}...`);
      
      // Create backup of current addon
      const currentPath = addonInfo.path;
      if (!currentPath) {
        throw new Error('Addon path not found');
      }
      
      const backupPath = `${currentPath}.backup.${Date.now()}`;
      
      if (fs.existsSync(currentPath)) {
        await fs.promises.rename(currentPath, backupPath);
        logger.detail(`📦 Created backup: ${backupPath}`);
      }
      
      try {
        // Download fresh copy
        await this.downloadGitHubRepo(username, repoName, currentPath);
        
        // Load the updated addon
        const updatedAddon = await this.loader.loadAddon(currentPath);
        
        // Unload old addon and register new one
        await this.loader.unloadAddon(addonName);
        this.loader.registerAddon(updatedAddon, {
          name: addonName,
          path: currentPath,
          installed: true,
          enabled: true,
          version: updatedAddon.version || '1.0.0',
          description: updatedAddon.description || '',
          author: updatedAddon.author || '',
          license: updatedAddon.license || '',
          dependencies: updatedAddon.dependencies || [],
          source: 'github',
          githubUrl: githubUrl
        });
        
        // Register with hook manager
        this.hookManager.registerAddons([updatedAddon]);
        
        // Save to registry
        await this.saveToRegistry();
        
        // Remove backup if successful
        if (fs.existsSync(backupPath)) {
          await fs.promises.rm(backupPath, { recursive: true });
        }
        
        logger.success(`✅ Successfully updated addon: ${addonName}`);
        
      } catch (updateError) {
        // Restore backup on failure
        if (fs.existsSync(backupPath)) {
          if (fs.existsSync(currentPath)) {
            await fs.promises.rm(currentPath, { recursive: true });
          }
          await fs.promises.rename(backupPath, currentPath);
          logger.info('🔄 Restored backup after failed update');
        }
        throw updateError;
      }
      
    } catch (error) {
      logger.error(`❌ Failed to update GitHub addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Update all addons
   */
  async updateAllAddons(): Promise<void> {
    try {
      logger.info('🔄 Updating all addons...');
      
      const addons = await this.listAddons();
      const githubAddons = addons.filter(addon => addon.source === 'github');
      
      if (githubAddons.length === 0) {
        logger.info('📦 No GitHub-based addons to update');
        return;
      }
      
      logger.info(`Found ${githubAddons.length} GitHub-based addon(s) to update`);
      
      let updated = 0;
      let failed = 0;
      const failedAddons: string[] = [];
      
      for (const addon of githubAddons) {
        try {
          logger.info(`\n📦 Updating: ${addon.name}`);
          await this.updateAddon(addon.name);
          updated++;
        } catch (error) {
          failed++;
          failedAddons.push(addon.name);
          logger.error(`❌ Failed to update ${addon.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
      
      // Summary
      logger.info('\n📊 Update Summary:');
      logger.info(`  ✅ Successfully updated: ${updated} addon(s)`);
      
      if (failed > 0) {
        logger.info(`  ❌ Failed to update: ${failed} addon(s): ${failedAddons.join(', ')}`);
        logger.info('💡 Try updating failed addons individually: tapi addon update <name>');
      }
      
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
    if (!this.addonErrors.has(addonName)) {
      this.addonErrors.set(addonName, []);
    }
    this.addonErrors.get(addonName)!.push(error);
  }

  /**
   * Get errors for a specific addon
   */
  getAddonErrors(addonName: string): string[] {
    return this.addonErrors.get(addonName) || [];
  }

  /**
   * Clear errors for a specific addon
   */
  clearAddonErrors(addonName: string): void {
    this.addonErrors.delete(addonName);
  }

  /**
   * Get all addon errors
   */
  getAllAddonErrors(): Map<string, string[]> {
    return new Map(this.addonErrors);
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
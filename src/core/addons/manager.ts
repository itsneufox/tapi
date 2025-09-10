import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { HookManager } from './hooks';
import { PawnctlAPI } from './types';

const execAsync = promisify(exec);

export class AddonManager {
  private loader: AddonLoader;
  private hookManager: HookManager;
  private addonsDir: string;
  private globalAddonsDir: string;
  private registryFile: string;
  private api: PawnctlAPI;
  private addonsLoaded: boolean = false;
  
  constructor() {
    // For packaged executables, use a different addon directory structure
    if (this.isPackagedExecutable()) {
      // Use a global addons directory for packaged executables
      this.addonsDir = path.join(require('os').homedir(), '.pawnctl', 'addons');
      this.globalAddonsDir = this.addonsDir;
    } else {
      // For development, use project-local addons
      this.addonsDir = path.join(process.cwd(), '.pawnctl', 'addons');
      this.globalAddonsDir = path.join(require('os').homedir(), '.pawnctl', 'addons');
    }
    
    this.registryFile = path.join(require('os').homedir(), '.pawnctl', 'addons.json');
    
    // Initialize API (will be properly implemented later)
    this.api = this.createAPI();
    
    this.loader = new AddonLoader(this.addonsDir, this.api);
    this.hookManager = new HookManager();
    
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
    
    // Check if executable path contains pawnctl
    if (process.execPath.includes('pawnctl')) {
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
    
    await this.initializeAddons();
  }
  
  private async loadFromRegistry(): Promise<void> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return;
      }
      
      const registryData = JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
      
      for (const addonInfo of registryData.addons || []) {
        if (addonInfo.path && fs.existsSync(addonInfo.path)) {
          try {
            const addon = await this.loader.loadAddon(addonInfo.path);
            this.loader.registerAddon(addon, addonInfo);
          } catch {
            logger.warn(`⚠️ Failed to load addon from registry: ${addonInfo.name}`);
          }
        }
      }
      
      // Register loaded addons with hook manager
      const loadedAddons = this.loader.getAllAddons();
      this.hookManager.registerAddons(loadedAddons);
    } catch (error) {
      logger.warn(`⚠️ Failed to load addon registry: ${error instanceof Error ? error.message : 'unknown error'}`);
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
  
  private createAPI(): PawnctlAPI {
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
        // This will integrate with the existing install command
        logger.info(`Installing package: ${packageName}`);
      },
      uninstallPackage: async (packageName: string) => {
        // This will integrate with the existing uninstall command
        logger.info(`Uninstalling package: ${packageName}`);
      },
      build: async (input: string, _options?: Record<string, unknown>) => {
        // This will integrate with the existing build command
        logger.info(`Building: ${input}`);
      },
      startServer: async (_config?: Record<string, unknown>) => {
        // This will integrate with the existing start command
        logger.info('Starting server...');
      },
      stopServer: async () => {
        // This will integrate with the existing stop command
        logger.info('Stopping server...');
      },
      getProjectRoot: () => process.cwd(),
      getConfig: () => ({}), // Will integrate with config system
      setConfig: (_config: Record<string, unknown>) => {
        // Will integrate with config system
      }
    };
  }
  
  /**
   * Install an addon
   */
  async installAddon(addonName: string, options: Record<string, unknown> = {}): Promise<void> {
    const isGlobal = options.global || false;
    const _isDev = options.dev || false;
    
    try {
      // Determine installation directory
      const installDir = isGlobal ? this.globalAddonsDir : this.addonsDir;
      
      // Ensure directory exists
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }
      
      // Check if it's a local path
      const isLocalPath = addonName.startsWith('./') || addonName.startsWith('../') || path.isAbsolute(addonName);
      
      if (isLocalPath) {
        // Handle local path installation
        const resolvedPath = path.resolve(addonName);
        logger.detail(`Installing local addon from ${resolvedPath}`);
        
        // Load the addon directly
        const addon = await this.loader.loadAddon(resolvedPath);
        
        // Register with hook manager
        this.hookManager.registerAddons([addon]);
        
        // Register with loader for persistence
        this.loader.registerAddon(addon, {
          path: resolvedPath,
          installed: true,
          enabled: true
        });
        
        // Save to registry
        await this.saveToRegistry();
        
        logger.success(`✅ Installed local addon: ${addon.name}@${addon.version}`);
        return;
      }
      
      // Install via our own GitHub downloader for remote packages
      if (addonName.startsWith('https://github.com/')) {
        const match = addonName.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          throw new Error('Invalid GitHub URL format');
        }
        
        const [, username, repoName] = match;
        const addonPath = path.join(installDir, `${username}-${repoName}`);
        
        logger.detail(`Downloading addon from GitHub: ${username}/${repoName}`);
        
        // Download the repository
        await this.downloadGitHubRepo(username, repoName, addonPath);
        
        // Load the addon
        const addon = await this.loader.loadAddon(addonPath);
        
        // Register with hook manager
        this.hookManager.registerAddons([addon]);
        
        // Register with loader for persistence
        this.loader.registerAddon(addon, {
          path: addonPath,
          installed: true,
          enabled: true
        });
        
        // Save to registry
        await this.saveToRegistry();
        
        logger.success(`✅ Installed addon: ${addon.name}@${addon.version}`);
        return;
      }
      
      // For non-GitHub URLs, throw an error for now
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
      // Unload the addon first
      await this.loader.unloadAddon(addonName);
      
      // Remove from npm
      await execAsync(`cd "${installDir}" && npm uninstall ${addonName}`);
      
      logger.success(`✅ Uninstalled addon: ${addonName}`);
      
    } catch (_error) {
      logger.error(`❌ Failed to uninstall addon ${addonName}: ${_error instanceof Error ? _error.message : 'unknown error'}`);
      throw _error;
    }
  }
  
  /**
   * List installed addons
   */
  async listAddons(_options: Record<string, unknown> = {}): Promise<void> {
    const isGlobal = _options.global || false;
    const showEnabled = _options.enabled || false;
    const showDisabled = _options.disabled || false;
    
    try {
      // Ensure addons are loaded
      await this.ensureAddonsLoaded();
      
      const addons = this.loader.getAllAddons();
      
      if (addons.length === 0) {
        logger.info('No addons installed');
        return;
      }
      
      logger.info(`📦 Installed addons${isGlobal ? ' (global)' : ''}:`);
      
      for (const addon of addons) {
        const addonInfo = this.loader.getAddonInfo(addon.name);
        const status = addonInfo?.enabled ? '✅ enabled' : '❌ disabled';
        
        if (showEnabled && !addonInfo?.enabled) continue;
        if (showDisabled && addonInfo?.enabled) continue;
        
        logger.info(`  ${addon.name}@${addon.version} ${status}`);
        logger.info(`    ${addon.description}`);
        logger.info(`    by ${addon.author}`);
        
        if (addonInfo?.path) {
          logger.info(`    path: ${addonInfo.path}`);
        }
      }
      
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
  async searchAddons(query: string, _limit: number = 10): Promise<void> {
    try {
      logger.info(`🔍 Searching for addons: "${query}"`);
      
      // This would integrate with npm search or a custom registry
      // For now, we'll show a placeholder
      logger.info('Search functionality will be implemented with addon registry');
      logger.info(`Would search for: ${query} (limit: ${_limit})`);
      
    } catch (error) {
      logger.error(`❌ Failed to search addons: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
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
  async updateAddon(_addonName: string): Promise<void> {
    try {
      logger.info(`🔄 Updating addon: ${_addonName}`);
      
      // This would update the addon via npm
      logger.info('Update functionality will be implemented');
      
    } catch (error) {
      logger.error(`❌ Failed to update addon ${_addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Update all addons
   */
  async updateAllAddons(): Promise<void> {
    try {
      logger.info('🔄 Updating all addons...');
      
      // This would update all addons via npm
      logger.info('Update all functionality will be implemented');
      
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
   * Get addon loader for integration with other commands
   */
  getLoader(): AddonLoader {
    return this.loader;
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
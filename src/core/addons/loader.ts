import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { 
  TapiAddon, 
  AddonContext, 
  AddonInfo, 
  AddonRegistryEntry,
  TapiAPI 
} from './types';

export class AddonLoader {
  private addons: Map<string, AddonRegistryEntry> = new Map();
  private context: AddonContext;
  private addonsDir: string;
  
  constructor(addonsDir: string, api: TapiAPI) {
    this.addonsDir = addonsDir;
    this.context = {
      logger,
      config: {}, // Will be properly initialized later
      events: new EventEmitter(),
      api
    };
    
    // Ensure addons directory exists
    this.ensureAddonsDir();
  }
  
  private ensureAddonsDir(): void {
    if (!fs.existsSync(this.addonsDir)) {
      fs.mkdirSync(this.addonsDir, { recursive: true });
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
   * Load an addon from a package or local path with retry mechanism
   */
  async loadAddon(addonPath: string, retries: number = 3): Promise<TapiAddon> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.attemptLoadAddon(addonPath);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries && this.isRetryableError(lastError)) {
          logger.warn(`⚠️ Addon load attempt ${attempt} failed, retrying... (${lastError.message})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }
    
    // All retries failed - provide detailed error information
    logger.error(`❌ Failed to load addon ${addonPath} after ${retries} attempts`);
    logger.error(`Last error: ${lastError?.message}`);
    
    // Provide recovery suggestions
    this.provideRecoverySuggestions(addonPath, lastError);
    
    throw lastError;
  }

  /**
   * Attempt to load an addon (single attempt)
   */
  private async attemptLoadAddon(addonPath: string): Promise<TapiAddon> {
    let addonModule;
    
    // Check if we're running from a packaged executable
    const isPackaged = this.isPackagedExecutable();
    
    if (isPackaged) {
      // For packaged executables, use require instead of import
      try {
        addonModule = require(addonPath);
      } catch {
        // Try loading from local path
        const localPath = path.resolve(addonPath);
        if (fs.existsSync(localPath)) {
          addonModule = require(localPath);
        } else {
          throw new Error(`Addon not found: ${addonPath}`);
        }
      }
    } else {
      // For development, use dynamic import
      try {
        addonModule = await import(addonPath);
      } catch {
        // Try loading from local path
        const localPath = path.resolve(addonPath);
        if (fs.existsSync(localPath)) {
          addonModule = await import(localPath);
        } else {
          throw new Error(`Addon not found: ${addonPath}`);
        }
      }
    }
    
    // Get the addon class/object
    const AddonClass = addonModule.default || addonModule;
    const addon = typeof AddonClass === 'function' ? new AddonClass() : AddonClass;
    
    // Validate addon
    this.validateAddon(addon);
    
    // Activate addon
    if (addon.activate) {
      await addon.activate(this.context);
    }
    
    logger.detail(`✅ Loaded addon: ${addon.name}@${addon.version}`);
    return addon;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ENOENT', // File not found
      'EACCES', // Permission denied
      'EMFILE', // Too many open files
      'ENFILE', // File system overload
      'ETIMEDOUT', // Timeout
      'ECONNRESET', // Connection reset
    ];
    
    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || error.name.includes(retryableError)
    );
  }

  /**
   * Provide recovery suggestions for failed addon loads
   */
  private provideRecoverySuggestions(addonPath: string, error: Error | null): void {
    logger.info('🔧 Recovery suggestions:');
    
    if (error?.message.includes('Addon not found')) {
      logger.info('  • Verify the addon path is correct');
      logger.info('  • Ensure the addon directory exists and contains valid files');
    } else if (error?.message.includes('Invalid addon structure')) {
      logger.info('  • Ensure your addon exports a class that extends TapiAddon');
      logger.info('  • Check that your addon has proper constructor and methods');
    } else if (error?.message.includes('Cannot resolve module')) {
      logger.info('  • Check that all dependencies are installed');
      logger.info('  • Run npm install in the addon directory');
    } else if (error?.message.includes('SyntaxError')) {
      logger.info('  • Check for syntax errors in your addon code');
      logger.info('  • Validate JavaScript syntax');
    } else if (error?.message.includes('EACCES') || error?.message.includes('Permission denied')) {
      logger.info('  • Check file permissions on the addon directory');
      logger.info('  • Ensure tapi has read access to the addon files');
    } else {
      logger.info('  • Check addon documentation for setup requirements');
      logger.info('  • Verify addon compatibility with current tapi version');
    }
    
    logger.info(`  • Run 'tapi addon list' to see working addons`);
    logger.info(`  • Try reinstalling the addon: 'tapi addon uninstall <name> && tapi addon install <name>'`);
  }
  
  /**
   * Unload an addon
   */
  async unloadAddon(name: string): Promise<void> {
    const entry = this.addons.get(name);
    if (!entry) {
      throw new Error(`Addon not found: ${name}`);
    }
    
    try {
      // Deactivate addon
      if (entry.addon.deactivate) {
        await entry.addon.deactivate();
      }
      
      this.addons.delete(name);
      logger.info(`✅ Unloaded addon: ${name}`);
      
    } catch (error) {
      logger.error(`❌ Failed to unload addon ${name}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get an addon by name
   */
  getAddon(name: string): TapiAddon | undefined {
    return this.addons.get(name)?.addon;
  }
  
  /**
   * Get all loaded addons
   */
  getAllAddons(): TapiAddon[] {
    return Array.from(this.addons.values()).map(entry => entry.addon);
  }
  
  /**
   * Get addon info
   */
  getAddonInfo(name: string): AddonInfo | undefined {
    const entry = this.addons.get(name);
    if (!entry) return undefined;
    
    return {
      name: entry.addon.name,
      version: entry.addon.version,
      description: entry.addon.description,
      author: entry.addon.author,
      license: entry.addon.license,
      installed: entry.info.installed,
      enabled: entry.info.enabled,
      dependencies: entry.addon.dependencies || [],
      path: entry.info.path
    };
  }
  
  /**
   * Register an addon
   */
  registerAddon(addon: TapiAddon, info?: Partial<AddonInfo>): void {
    const entry: AddonRegistryEntry = {
      addon,
      info: {
        name: addon.name,
        version: addon.version,
        description: addon.description,
        author: addon.author,
        license: addon.license,
        installed: true,
        enabled: true,
        dependencies: addon.dependencies || [],
        ...info
      }
    };
    
    this.addons.set(addon.name, entry);
  }
  
  /**
   * Load all addons from the addons directory
   */
  async loadAllAddons(): Promise<void> {
    try {
      const addonDirs = fs.readdirSync(this.addonsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const addonDir of addonDirs) {
        const addonPath = path.join(this.addonsDir, addonDir);
        const packageJsonPath = path.join(addonPath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const mainFile = packageJson.main || 'index.js';
          const addonFilePath = path.join(addonPath, mainFile);
          
          await this.loadAddon(addonFilePath);
          } catch (error) {
            logger.warn(`⚠️ Failed to load addon from ${addonDir}: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }
      }
      
      logger.info(`📦 Loaded ${this.addons.size} addons`);
      
    } catch (error) {
      logger.error(`❌ Failed to load addons: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  
  /**
   * Validate addon structure
   */
  private validateAddon(addon: unknown): asserts addon is TapiAddon {
    if (!addon || typeof addon !== 'object') {
      throw new Error('Addon must be an object');
    }
    
    const addonObj = addon as Record<string, unknown>;
    
    if (!addonObj.name || typeof addonObj.name !== 'string') {
      throw new Error('Addon must have a valid name');
    }
    
    if (!addonObj.version || typeof addonObj.version !== 'string') {
      throw new Error('Addon must have a valid version');
    }
    
    if (!addonObj.description || typeof addonObj.description !== 'string') {
      throw new Error('Addon must have a valid description');
    }
    
    if (!addonObj.author || typeof addonObj.author !== 'string') {
      throw new Error('Addon must have a valid author');
    }
    
    if (!addonObj.license || typeof addonObj.license !== 'string') {
      throw new Error('Addon must have a valid license');
    }
    
    if (!addonObj.hooks || typeof addonObj.hooks !== 'object') {
      throw new Error('Addon must have a hooks object');
    }
    
    // Validate hooks are functions
    for (const [hookName, hook] of Object.entries(addonObj.hooks as Record<string, unknown>)) {
      if (hook && typeof hook !== 'function') {
        throw new Error(`Hook ${hookName} must be a function`);
      }
    }
    
    // Validate commands if present
    if (addonObj.commands) {
      if (!Array.isArray(addonObj.commands)) {
        throw new Error('Addon commands must be an array');
      }
      
      for (const command of addonObj.commands) {
        if (!command.name || typeof command.name !== 'string') {
          throw new Error('Addon command must have a valid name');
        }
        
        if (!command.handler || typeof command.handler !== 'function') {
          throw new Error('Addon command must have a valid handler');
        }
      }
    }
  }
}

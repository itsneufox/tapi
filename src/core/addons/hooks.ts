import { logger } from '../../utils/logger';
import { 
  TapiAddon, 
  BuildContext, 
  PackageInfo, 
  ServerConfig, 
  ProjectInfo 
} from './types';

type HookHandler = (...args: unknown[]) => Promise<void> | void;

export class HookManager {
  private hooks: Map<string, HookHandler[]> = new Map();
  private addons: TapiAddon[] = [];
  
  constructor() {
    // Initialize hook maps
    this.initializeHooks();
  }
  
  private initializeHooks(): void {
    const hookNames = [
      'preBuild', 'postBuild',
      'preInstall', 'postInstall', 'preUninstall', 'postUninstall',
      'preStart', 'postStart', 'preStop', 'postStop',
      'preInit', 'postInit',
      'onEvent'
    ];
    
    for (const hookName of hookNames) {
      this.hooks.set(hookName, []);
    }
  }
  
  /**
   * Register addons and their hooks
   */
  registerAddons(addons: TapiAddon[]): void {
    this.addons = addons;
    this.clearHooks();
    
    for (const addon of addons) {
      this.registerAddonHooks(addon);
    }
    
    logger.detail(`🔗 Registered hooks for ${addons.length} addons`);
  }
  
  /**
   * Register hooks for a single addon
   */
  private registerAddonHooks(addon: TapiAddon): void {
    for (const [hookName, hook] of Object.entries(addon.hooks)) {
      if (hook && typeof hook === 'function') {
        this.registerHook(hookName, hook);
        logger.detail(`  📌 ${addon.name}: ${hookName}`);
      }
    }
  }
  
  /**
   * Register a hook function
   */
  registerHook(event: string, handler: HookHandler): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(handler);
  }
  
  /**
   * Execute all hooks for an event
   */
  async executeHook(event: string, context: unknown): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    
    if (handlers.length === 0) {
      return;
    }
    
    logger.detail(`🎣 Executing ${handlers.length} hooks for: ${event}`);
    
    const failedHooks: string[] = [];
    
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'unknown error';
        logger.error(`❌ Hook ${event} failed: ${errorMsg}`);
        failedHooks.push(event);
        
        // Provide recovery suggestions for hook failures
        this.provideHookRecoverySuggestions(event, errorMsg);
        
        // Continue executing other hooks even if one fails
      }
    }
    
    // Report hook execution summary
    if (failedHooks.length > 0) {
      logger.warn(`⚠️ ${failedHooks.length} hook(s) failed during ${event} event`);
    }
  }
  
  /**
   * Provide recovery suggestions for hook failures
   */
  private provideHookRecoverySuggestions(event: string, errorMsg: string): void {
    logger.info('🔧 Hook recovery suggestions:');
    
    if (errorMsg.includes('Cannot read property') || errorMsg.includes('undefined')) {
      logger.info('  • Check that the hook context contains expected properties');
      logger.info('  • Verify hook implementation matches the expected interface');
    } else if (errorMsg.includes('Permission denied') || errorMsg.includes('EACCES')) {
      logger.info('  • Check file permissions for the operation');
      logger.info('  • Ensure tapi has write access to required directories');
    } else if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      logger.info('  • Verify that required files exist before accessing them');
      logger.info('  • Check file paths in hook implementation');
    } else {
      logger.info('  • Review hook implementation for logical errors');
      logger.info('  • Check addon documentation for hook usage examples');
    }
    
    logger.info(`  • Disable the problematic addon: 'tapi addon disable <addon-name>'`);
    logger.info(`  • Check addon status: 'tapi addon list'`);
  }

  /**
   * Clear all registered hooks
   */
  private clearHooks(): void {
    for (const [hookName] of this.hooks) {
      this.hooks.set(hookName, []);
    }
  }
  
  // Build lifecycle hooks
  async preBuild(context: BuildContext): Promise<void> {
    await this.executeHook('preBuild', context);
  }
  
  async postBuild(context: BuildContext): Promise<void> {
    await this.executeHook('postBuild', context);
  }
  
  // Package lifecycle hooks
  async preInstall(packageInfo: PackageInfo): Promise<void> {
    await this.executeHook('preInstall', packageInfo);
  }
  
  async postInstall(packageInfo: PackageInfo): Promise<void> {
    await this.executeHook('postInstall', packageInfo);
  }
  
  async preUninstall(packageInfo: PackageInfo): Promise<void> {
    await this.executeHook('preUninstall', packageInfo);
  }
  
  async postUninstall(packageInfo: PackageInfo): Promise<void> {
    await this.executeHook('postUninstall', packageInfo);
  }
  
  // Server lifecycle hooks
  async preStart(config: ServerConfig): Promise<void> {
    await this.executeHook('preStart', config);
  }
  
  async postStart(config: ServerConfig): Promise<void> {
    await this.executeHook('postStart', config);
  }
  
  async preStop(): Promise<void> {
    await this.executeHook('preStop', {});
  }
  
  async postStop(): Promise<void> {
    await this.executeHook('postStop', {});
  }
  
  // Project lifecycle hooks
  async preInit(project: ProjectInfo): Promise<void> {
    await this.executeHook('preInit', project);
  }
  
  async postInit(project: ProjectInfo): Promise<void> {
    await this.executeHook('postInit', project);
  }
  
  // Custom event hooks
  async onEvent(event: string, data: unknown): Promise<void> {
    await this.executeHook('onEvent', { event, data });
  }
  
  /**
   * Get hook statistics
   */
  getHookStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [hookName, handlers] of this.hooks) {
      stats[hookName] = handlers.length;
    }
    return stats;
  }
  
  /**
   * Get addon hook information
   */
  getAddonHooks(addonName: string): string[] {
    const addon = this.addons.find(a => a.name === addonName);
    if (!addon) return [];
    
    return Object.entries(addon.hooks)
      .filter(([_, hook]) => hook && typeof hook === 'function')
      .map(([hookName, _]) => hookName);
  }
}

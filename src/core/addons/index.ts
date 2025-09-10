// Export all addon-related types and classes
export * from './types';
export * from './loader';
export * from './hooks';
export * from './manager';

// Export a singleton instance for easy access
import { AddonManager } from './manager';

let addonManagerInstance: AddonManager | null = null;

export function getAddonManager(): AddonManager {
  if (!addonManagerInstance) {
    addonManagerInstance = new AddonManager();
  }
  return addonManagerInstance;
}

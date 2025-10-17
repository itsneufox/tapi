// Export all addon-related types and classes
export * from './types';
export * from './loader';
export * from './hooks';
export * from './manager';

// Export a singleton instance for easy access
import { AddonManager } from './manager';

let addonManagerInstance: AddonManager | null = null;

/**
 * Retrieve the shared AddonManager instance, creating it on first use.
 */
export function getAddonManager(program?: unknown): AddonManager {
  if (!addonManagerInstance) {
    addonManagerInstance = new AddonManager(program);
  }
  return addonManagerInstance;
}

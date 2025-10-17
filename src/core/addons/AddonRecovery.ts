import { logger } from '../../utils/logger';
import { AddonRegistry } from './AddonRegistry';

/**
 * Maintains a record of addon load failures and performs recovery actions.
 */
export class AddonRecovery {
  private addonErrors: Map<string, string[]> = new Map();

  constructor(private registry: AddonRegistry) {}

  /**
   * Record an error for a specific addon.
   *
   * @param addonName - The addon that encountered an error.
   * @param error - Error message to store.
   */
  recordAddonError(addonName: string, error: string): void {
    if (!this.addonErrors.has(addonName)) {
      this.addonErrors.set(addonName, []);
    }
    this.addonErrors.get(addonName)!.push(error);
  }

  /**
   * Get every stored error for the provided addon.
   *
   * @param addonName - Addon identifier to inspect.
   * @returns Array of recorded error messages (empty if none).
   */
  getAddonErrors(addonName: string): string[] {
    return this.addonErrors.get(addonName) || [];
  }

  /**
   * Remove any stored errors for the addon.
   *
   * @param addonName - Addon whose errors should be cleared.
   */
  clearAddonErrors(addonName: string): void {
    this.addonErrors.delete(addonName);
  }

  /**
   * Retrieve a copy of the entire error map.
   *
   * @returns Snapshot of addon error messages keyed by addon name.
   */
  getAllAddonErrors(): Map<string, string[]> {
    return new Map(this.addonErrors);
  }

  /**
   * Attempt automatic recovery by disabling the addon in the registry.
   *
   * @param addonName - Addon that failed to load or run.
   * @param errorMsg - Error to persist alongside the disabled addon.
   */
  async attemptAddonRecovery(addonName: string, errorMsg: string): Promise<void> {
    try {
      await this.registry.disableAddonInRegistry(addonName, errorMsg);
    } catch (error) {
      logger.detail(
        `⚠️ Could not auto-disable addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }
}

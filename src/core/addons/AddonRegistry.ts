import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { AddonInfo } from './types';

/**
 * Manages the addon registry file that persists addon information
 */
export class AddonRegistry {
  constructor(
    private registryFile: string,
    private loader: AddonLoader
  ) {}

  /**
   * Load addons from the registry file
   * @returns Arrays of successfully loaded and failed addon names
   */
  async loadFromRegistry(): Promise<{
    loaded: string[];
    failed: string[];
  }> {
    const loadedAddons: string[] = [];
    const failedAddons: string[] = [];

    try {
      if (!fs.existsSync(this.registryFile)) {
        return { loaded: loadedAddons, failed: failedAddons };
      }

      const registryData = JSON.parse(
        fs.readFileSync(this.registryFile, 'utf8')
      );

      for (const addonInfo of registryData.addons || []) {
        if (addonInfo.path && fs.existsSync(addonInfo.path)) {
          try {
            const addon = await this.loader.loadAddon(addonInfo.path);
            this.loader.registerAddon(addon, addonInfo);
            loadedAddons.push(addonInfo.name);
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : 'unknown error';
            logger.warn(
              `Failed to load addon from registry: ${addonInfo.name} (${errorMsg})`
            );
            failedAddons.push(addonInfo.name);
          }
        } else {
          logger.warn(
            `Addon path not found: ${addonInfo.name} (${addonInfo.path})`
          );
          failedAddons.push(addonInfo.name);
        }
      }

      // Report loading summary
      if (loadedAddons.length > 0) {
        logger.detail(
          `Successfully loaded ${loadedAddons.length} addon(s): ${loadedAddons.join(', ')}`
        );
      }

      if (failedAddons.length > 0) {
        logger.warn(
          `Failed to load ${failedAddons.length} addon(s): ${failedAddons.join(', ')}`
        );
        logger.info(
          'Run "tapi addon list" to see addon status and recovery suggestions'
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to load addon registry: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    return { loaded: loadedAddons, failed: failedAddons };
  }

  /**
   * Save current addons to the registry file.
   *
   * @returns Promise that resolves once the registry is written.
   */
  async saveToRegistry(): Promise<void> {
    try {
      const addons = this.loader.getAllAddons();
      const registryData = {
        addons: addons
          .map((addon) => {
            const info = this.loader.getAddonInfo(addon.name);
            return info;
          })
          .filter((info) => info !== undefined),
      };

      // Ensure directory exists
      const registryDir = path.dirname(this.registryFile);
      if (!fs.existsSync(registryDir)) {
        fs.mkdirSync(registryDir, { recursive: true });
      }

      fs.writeFileSync(this.registryFile, JSON.stringify(registryData, null, 2));
    } catch (error) {
      logger.warn(
        `Failed to save addon registry: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Mark an addon as disabled in the registry
   * @param addonName - Name of the addon to disable
   * @param errorMsg - Error message to record
   */
  async disableAddonInRegistry(
    addonName: string,
    errorMsg: string
  ): Promise<void> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return;
      }

      const registryContent = await fs.promises.readFile(
        this.registryFile,
        'utf8'
      );
      const registryData = JSON.parse(registryContent);

      const addons = registryData?.addons as AddonInfo[] | undefined;
      const addonIndex = addons?.findIndex(
        (addon: AddonInfo) => addon.name === addonName
      );

      if (addonIndex !== undefined && addonIndex >= 0 && addons) {
        addons[addonIndex].enabled = false;
        addons[addonIndex].lastError = errorMsg;
        addons[addonIndex].lastErrorTime = new Date().toISOString();

        await fs.promises.writeFile(
          this.registryFile,
          JSON.stringify(registryData, null, 2)
        );
        logger.detail(`Automatically disabled problematic addon: ${addonName}`);
      }
    } catch (recoveryError) {
      logger.detail(
        `Could not auto-disable addon ${addonName}: ${recoveryError instanceof Error ? recoveryError.message : 'unknown error'}`
      );
    }
  }

  /**
   * Update addon information in the registry
   * @param addonName - Name of the addon
   * @param updates - Partial addon info to update
   */
  async updateAddonInRegistry(
    addonName: string,
    updates: Partial<AddonInfo>
  ): Promise<void> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return;
      }

      const registryContent = await fs.promises.readFile(
        this.registryFile,
        'utf8'
      );
      const registryData = JSON.parse(registryContent);

      const addons = registryData?.addons as AddonInfo[] | undefined;
      const addonIndex = addons?.findIndex(
        (addon: AddonInfo) => addon.name === addonName
      );

      if (addonIndex !== undefined && addonIndex >= 0 && addons) {
        addons[addonIndex] = { ...addons[addonIndex], ...updates };

        await fs.promises.writeFile(
          this.registryFile,
          JSON.stringify(registryData, null, 2)
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to update addon in registry: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Remove an addon from the registry
   * @param addonName - Name of the addon to remove
   */
  async removeAddonFromRegistry(addonName: string): Promise<void> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return;
      }

      const registryContent = await fs.promises.readFile(
        this.registryFile,
        'utf8'
      );
      const registryData = JSON.parse(registryContent);

      const addons = registryData?.addons as AddonInfo[] | undefined;
      if (addons) {
        registryData.addons = addons.filter(
          (addon: AddonInfo) => addon.name !== addonName
        );

        await fs.promises.writeFile(
          this.registryFile,
          JSON.stringify(registryData, null, 2)
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to remove addon from registry: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Check if registry file exists.
   *
   * @returns True when the registry file is present on disk.
   */
  exists(): boolean {
    return fs.existsSync(this.registryFile);
  }

  /**
   * Get raw registry data.
   *
   * @returns Parsed registry object or null if not present.
   */
  async getRawData(): Promise<Record<string, unknown> | null> {
    try {
      if (!fs.existsSync(this.registryFile)) {
        return null;
      }

      const registryContent = await fs.promises.readFile(
        this.registryFile,
        'utf8'
      );
      return JSON.parse(registryContent);
    } catch (error) {
      logger.warn(
        `Failed to read registry: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      return null;
    }
  }
}

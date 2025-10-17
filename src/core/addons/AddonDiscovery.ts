import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { AddonInfo } from './types';

/**
 * Discovers addons in node_modules and global directories
 */
export class AddonDiscovery {
  constructor(private loader: AddonLoader) {}

  /**
   * Discover addons in node_modules directories.
   *
   * @param projectPath - Project root path.
   * @param globalAddonsDir - Global addons directory.
   * @param isPackagedExecutable - Whether running as packaged executable.
   * @returns Promise that resolves once discovery completes.
   */
  async discoverNodeModulesAddons(
    projectPath: string,
    globalAddonsDir: string,
    isPackagedExecutable: boolean
  ): Promise<void> {
    try {
      // Discover addons in project's node_modules
      await this.discoverAddonsInDirectory(
        path.join(projectPath, 'node_modules'),
        'node_modules'
      );

      // Discover addons in global addon directory (for packaged executables)
      if (isPackagedExecutable && fs.existsSync(globalAddonsDir)) {
        await this.discoverAddonsInDirectory(globalAddonsDir, 'global');
      }
    } catch (error) {
      logger.detail(
        `Addon discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Discover addons in a specific directory.
   *
   * @param dirPath - Directory to search.
   * @param source - Source identifier (for logging).
   * @returns Promise that resolves once discovery completes.
   */
  async discoverAddonsInDirectory(
    dirPath: string,
    source: string
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return; // Directory doesn't exist
    }

    const dirContents = fs.readdirSync(dirPath);
    const tapiAddons = dirContents.filter(
      (name) => name.startsWith('tapi-') && name !== 'tapi'
    );

    for (const addonName of tapiAddons) {
      await this.discoverSingleAddon(
        path.join(dirPath, addonName),
        source
      );
    }
  }

  /**
   * Discover and load a single addon.
   *
   * @param addonPath - Path to the addon directory.
   * @param source - Source identifier.
   */
  private async discoverSingleAddon(
    addonPath: string,
    source: string
  ): Promise<void> {
    const packageJsonPath = path.join(addonPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return; // Skip if no package.json
    }

    try {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8')
      );
      const tapiConfig = packageJson.tapi;

      if (!tapiConfig) {
        return; // Skip if no tapi config
      }

      // Check if addon is already registered
      const existingAddon = this.loader.getAddonInfo(tapiConfig.name);
      if (existingAddon) {
        return; // Already registered
      }

      // Try to load the addon
      const mainFile = packageJson.main || 'index.js';
      const addonFilePath = path.join(addonPath, mainFile);

      if (fs.existsSync(addonFilePath)) {
        await this.loadAndRegisterAddon(
          addonFilePath,
          addonPath,
          tapiConfig,
          packageJson,
          source
        );
      }
    } catch (error) {
      logger.detail(
        `Failed to discover addon at ${addonPath}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Load and register a discovered addon.
   *
   * @param addonFilePath - Path to the addon entry file.
   * @param addonPath - Directory that hosts the addon.
   * @param tapiConfig - Addon-defined metadata from package.json.
   * @param packageJson - Full package.json object for fallback metadata.
   * @param source - Source identifier for logging.
   */
  private async loadAndRegisterAddon(
    addonFilePath: string,
    addonPath: string,
    tapiConfig: Record<string, unknown>,
    packageJson: Record<string, unknown>,
    source: string
  ): Promise<void> {
    const addon = await this.loader.loadAddon(addonFilePath);

    const addonInfo: AddonInfo = {
      name: tapiConfig.name as string,
      version: (tapiConfig.version as string) || (packageJson.version as string),
      description:
        (tapiConfig.description as string) || (packageJson.description as string),
      author: (tapiConfig.author as string) || (packageJson.author as string),
      license: (tapiConfig.license as string) || (packageJson.license as string),
      installed: true,
      enabled: true,
      path: addonPath,
      dependencies: (tapiConfig.dependencies as string[]) || [],
    };

    this.loader.registerAddon(addon, addonInfo);
    logger.detail(`Discovered addon: ${addonInfo.name} from ${source}`);
  }

  /**
   * Search for addons matching a query in node_modules.
   *
   * @param query - Search query.
   * @param projectPath - Project root path.
   * @param globalAddonsDir - Global addons directory.
   * @returns All matching addon infos discovered on disk.
   */
  async searchNodeModulesAddons(
    query: string,
    projectPath: string,
    globalAddonsDir: string
  ): Promise<AddonInfo[]> {
    const foundAddons: AddonInfo[] = [];
    const lowerQuery = query.toLowerCase();

    // Search in project node_modules
    await this.searchInDirectory(
      path.join(projectPath, 'node_modules'),
      lowerQuery,
      foundAddons
    );

    // Search in global addons
    if (fs.existsSync(globalAddonsDir)) {
      await this.searchInDirectory(
        globalAddonsDir,
        lowerQuery,
        foundAddons
      );
    }

    return foundAddons;
  }

  /**
   * Search for addons in a specific directory.
   *
   * @param dirPath - Directory to inspect.
   * @param query - Lowercased query string.
   * @param results - Mutable array that receives matches.
   */
  private async searchInDirectory(
    dirPath: string,
    query: string,
    results: AddonInfo[]
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    try {
      const dirContents = fs.readdirSync(dirPath);
      const tapiAddons = dirContents.filter(
        (name) => name.startsWith('tapi-') && name !== 'tapi'
      );

      for (const addonName of tapiAddons) {
        const addonPath = path.join(dirPath, addonName);
        const packageJsonPath = path.join(addonPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          continue;
        }

        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        );
        const tapiConfig = packageJson.tapi;

        if (!tapiConfig) {
          continue;
        }

        // Check if addon matches query
        const name = (tapiConfig.name as string) || addonName;
        const description = (tapiConfig.description as string) || '';

        if (
          name.toLowerCase().includes(query) ||
          description.toLowerCase().includes(query) ||
          addonName.toLowerCase().includes(query)
        ) {
          results.push({
            name,
            version: (tapiConfig.version as string) || (packageJson.version as string),
            description,
            author: (tapiConfig.author as string) || (packageJson.author as string),
            license: (tapiConfig.license as string) || (packageJson.license as string),
            installed: false,
            enabled: false,
            path: addonPath,
            dependencies: (tapiConfig.dependencies as string[]) || [],
          });
        }
      }
    } catch (error) {
      logger.detail(
        `Failed to search directory ${dirPath}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }
}

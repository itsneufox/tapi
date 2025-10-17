import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { AddonLoader } from './loader';
import { HookManager } from './hooks';
import { AddonRegistry } from './AddonRegistry';
import { GitHubDownloader } from './GitHubDownloader';
import { AddonInfo } from './types';

/**
 * Configuration options that control how an addon is installed.
 */
export interface InstallOptions {
  source?: 'github' | 'local';
  path?: string;
  global?: boolean;
}

/**
 * Handles addon installation, uninstallation, and updates
 */
export class AddonInstaller {
  /**
   * Create a new installer instance.
   *
   * @param loader - Loader used to hydrate addons from disk.
   * @param hooks - Hook manager that registers addon lifecycle hooks.
   * @param registry - Registry writer for persisting addon metadata.
   * @param github - GitHub downloader for remote installations.
   * @param projectAddonsDir - Local project addon directory.
   * @param globalAddonsDir - Global addon directory (used in packaged builds).
   */
  constructor(
    private loader: AddonLoader,
    private hooks: HookManager,
    private registry: AddonRegistry,
    private github: GitHubDownloader,
    private projectAddonsDir: string,
    private globalAddonsDir: string
  ) {}

  /**
   * Install an addon using the provided options.
   *
   * @param addonName - Human readable addon name or identifier.
   * @param options - Source and location information for the addon.
   */
  async installAddon(addonName: string, options: InstallOptions = {}): Promise<void> {
    const isGlobal = options.global || false;
    const installDir = isGlobal ? this.globalAddonsDir : this.projectAddonsDir;

    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    // Determine source
    const source = options.source;
    const srcPath = options.path || addonName;

    if (source === 'local' || this.isLocalPath(srcPath)) {
      const resolvedPath = path.resolve(srcPath);
      await this.installFromLocal(resolvedPath);
      return;
    }

    if (source === 'github' || srcPath.startsWith('https://github.com/') || srcPath.includes('/')) {
      await this.installFromGitHub(srcPath, installDir, addonName);
      return;
    }

    throw new Error(`Unsupported addon source: ${srcPath}`);
  }

  /**
   * Uninstall an addon by name.
   *
   * @param addonName - The addon to uninstall.
   * @param isGlobal - Whether to remove the addon from the global directory.
   */
  async uninstallAddon(addonName: string, isGlobal = false): Promise<void> {
    const installDir = isGlobal ? this.globalAddonsDir : this.projectAddonsDir;

    await this.loader.unloadAddon(addonName);

    // Remove from filesystem if present
    const addonPath = path.join(installDir, addonName);
    if (fs.existsSync(addonPath)) {
      await fs.promises.rm(addonPath, { recursive: true, force: true });
    }

    await this.registry.removeAddonFromRegistry(addonName);
    logger.success(`✅ Uninstalled addon: ${addonName}`);
  }

  /**
   * Update a GitHub-sourced addon to the latest version.
   *
   * @param addonName - The addon to update.
   */
  async updateGitHubAddon(addonName: string): Promise<void> {
    const addonInfo = this.loader.getAddonInfo(addonName);
    if (!addonInfo) {
      throw new Error(`Addon not found: ${addonName}`);
    }

    const githubUrl = addonInfo.githubUrl || '';
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }

    const [, username, repoName] = match;

    logger.info(`📥 Downloading latest version from ${username}/${repoName}...`);

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
      await this.github.downloadRepo(username, repoName, currentPath);

      const updatedAddon = await this.loader.loadAddon(currentPath);

      // Unload old and register new
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
        githubUrl: githubUrl,
      });

      this.hooks.registerAddons([updatedAddon]);
      await this.registry.saveToRegistry();

      // Cleanup backup
      if (fs.existsSync(backupPath)) {
        await fs.promises.rm(backupPath, { recursive: true });
      }

      logger.success(`✅ Successfully updated addon: ${addonName}`);
    } catch (error) {
      // Restore backup on failure
      if (fs.existsSync(backupPath)) {
        if (fs.existsSync(currentPath)) {
          await fs.promises.rm(currentPath, { recursive: true });
        }
        await fs.promises.rename(backupPath, currentPath);
        logger.info('🔄 Restored backup after failed update');
      }
      throw error;
    }
  }

  /**
   * Update every GitHub-based addon currently installed.
   */
  async updateAllGitHubAddons(): Promise<void> {
    logger.info('🔄 Updating all addons...');

    const addons = this.loader.getAllAddons();
    const githubAddons = addons
      .map((a) => this.loader.getAddonInfo(a.name))
      .filter((i): i is AddonInfo => !!i)
      .filter((i) => i.source === 'github');

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
        await this.updateGitHubAddon(addon.name);
        updated++;
      } catch (error) {
        failed++;
        failedAddons.push(addon.name);
        logger.error(
          `❌ Failed to update ${addon.name}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    logger.info('\n📊 Update Summary:');
    logger.info(`  ✅ Successfully updated: ${updated} addon(s)`);
    if (failed > 0) {
      logger.info(
        `  ❌ Failed to update: ${failed} addon(s): ${failedAddons.join(', ')}`
      );
      logger.info(
        '💡 Try updating failed addons individually: tapi addon update <name>'
      );
    }
  }

  private isLocalPath(p: string): boolean {
    return p.startsWith('./') || p.startsWith('../') || path.isAbsolute(p);
  }

  /**
   * Install an addon from a local directory on disk.
   *
   * @param resolvedPath - Absolute path to the addon entry point or directory.
   */
  private async installFromLocal(resolvedPath: string): Promise<void> {
    logger.detail(`Installing local addon from ${resolvedPath}`);

    const addon = await this.loader.loadAddon(resolvedPath);
    this.hooks.registerAddons([addon]);
    this.loader.registerAddon(addon, {
      path: resolvedPath,
      installed: true,
      enabled: true,
      source: 'local',
    });
    await this.registry.saveToRegistry();

    logger.success(`✅ Installed local addon: ${addon.name}@${addon.version}`);
  }

  /**
   * Install an addon from a GitHub identifier or URL.
   *
   * @param identifier - GitHub spec (user/repo[@ref] or full URL).
   * @param installDir - Target directory for the downloaded addon.
   * @param addonNameHint - Optional directory name hint when installing.
   */
  private async installFromGitHub(identifier: string, installDir: string, addonNameHint?: string): Promise<void> {
    // Parse identifier: could be full URL or user/repo[@ref]
    let username = '';
    let repoName = '';
    let ref = 'main';

    const fullUrlMatch = identifier.match(/https:\/\/github\.com\/([^/]+)\/([^/@]+)(?:\/(?:tree|releases|archive)\/([^/]+))?/);
    if (fullUrlMatch) {
      username = fullUrlMatch[1];
      repoName = fullUrlMatch[2];
      ref = fullUrlMatch[3] || 'main';
    } else {
      const shortMatch = identifier.match(/^([^/]+)\/([^@]+)(?:@(.+))?$/);
      if (!shortMatch) {
        throw new Error('Invalid GitHub identifier. Use user/repo or full URL.');
      }
      username = shortMatch[1];
      repoName = shortMatch[2];
      ref = shortMatch[3] || 'main';
    }

    const targetDirName = addonNameHint && addonNameHint.trim().length > 0
      ? addonNameHint
      : `${username}-${repoName}`;
    const addonPath = path.join(installDir, targetDirName);

    logger.detail(`Downloading addon from GitHub: ${username}/${repoName}@${ref}`);
    await this.github.downloadRepo(username, repoName, addonPath, ref);

    const addon = await this.loader.loadAddon(addonPath);
    this.hooks.registerAddons([addon]);
    this.loader.registerAddon(addon, {
      path: addonPath,
      installed: true,
      enabled: true,
      source: 'github',
      githubUrl: `https://github.com/${username}/${repoName}`,
    });
    await this.registry.saveToRegistry();

    logger.success(`✅ Installed addon: ${addon.name}@${addon.version}`);
  }
}

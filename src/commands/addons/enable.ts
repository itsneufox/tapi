import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon enable` command to reactivate previously disabled addons.
 *
 * @param program - Commander instance to extend.
 */
export default function(program: Command): void {
  program
    .command('enable <addon>')
    .description('Enable a disabled addon')
    .action(async (addonName: string) => {
      showBanner(false);

      try {
        logger.heading(`Enabling addon: ${addonName}`);

        const addonManager = getAddonManager();
        
        // Check if addon is installed
        const installedAddons = await addonManager.listAddons();
        const addon = installedAddons.find(addon => addon.name === addonName);
        
        if (!addon || !addon.installed) {
          logger.error(`Addon '${addonName}' is not installed`);
          logger.info(`Run 'tapi addon install ${addonName}' to install it first`);
          return;
        }

        if (addon.enabled) {
          logger.warn(`Addon '${addonName}' is already enabled`);
          return;
        }

        // Enable the addon
        logger.working('Enabling addon');
        await addonManager.enableAddon(addonName);

        logger.success('Addon enabled successfully!');
        logger.info('');
        logger.info('The addon is now active and will run its hooks during project operations.');

      } catch (error) {
        logger.error(`Failed to enable addon: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



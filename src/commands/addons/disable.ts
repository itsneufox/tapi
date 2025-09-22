import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

export default function(program: Command): void {
  program
    .command('disable <addon>')
    .description('Disable an enabled addon')
    .action(async (addonName: string) => {
      showBanner(false);

      try {
        logger.heading(`⏸️ Disabling addon: ${addonName}`);

        const addonManager = getAddonManager();
        
        // Check if addon is installed
        const installedAddons = await addonManager.listAddons();
        const addon = installedAddons.find(addon => addon.name === addonName);
        
        if (!addon || !addon.installed) {
          logger.error(`❌ Addon '${addonName}' is not installed`);
          return;
        }

        if (!addon.enabled) {
          logger.warn(`⚠️ Addon '${addonName}' is already disabled`);
          return;
        }

        // Disable the addon
        logger.info('🔄 Disabling addon...');
        await addonManager.disableAddon(addonName);

        logger.info('✅ Addon disabled successfully!');
        logger.info('');
        logger.info('The addon is now inactive and will not run its hooks.');
        logger.info('Use "pawnctl addon enable" to re-enable it later.');

      } catch (error) {
        logger.error(`❌ Failed to disable addon: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon uninstall` command which removes installed addons.
 *
 * @param program - Commander instance to augment.
 */
export default function(program: Command): void {
  program
    .command('uninstall <addon>')
    .description('Remove a tapi addon')
    .option('-f, --force', 'Force removal without confirmation')
    .action(async (addonName: string, options) => {
      showBanner(false);

      try {
        logger.heading(`🗑️ Uninstalling addon: ${addonName}`);

        const addonManager = getAddonManager();
        
        // Check if addon is installed
        const installedAddons = await addonManager.listAddons();
        const addon = installedAddons.find(addon => addon.name === addonName);
        
        if (!addon || !addon.installed) {
          logger.error(`❌ Addon '${addonName}' is not installed`);
          return;
        }

        // Confirm removal unless --force is used
        if (!options.force) {
          logger.warn(`⚠️ This will permanently remove the addon '${addonName}'`);
          logger.info('Use --force to skip confirmation');
          return;
        }

        // Uninstall the addon
        logger.info('🗑️ Removing addon...');
        await addonManager.uninstallAddon(addonName);

        logger.info('✅ Addon uninstalled successfully!');
        logger.info('');
        logger.info('Note: This addon has been removed from your project.');
        logger.info('Any configuration it added to pawn.json may need manual cleanup.');

      } catch (error) {
        logger.error(`❌ Failed to uninstall addon: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

export default function(program: Command): void {
  program
    .command('update [addon]')
    .description('Update addons to their latest versions')
    .option('--all', 'Update all addons')
    .action(async (addonName, options) => {
      showBanner(false);

      try {
        const addonManager = getAddonManager();

        if (options.all) {
          // Update all addons
          await addonManager.updateAllAddons();
        } else if (addonName) {
          // Update specific addon
          await addonManager.updateAddon(addonName);
        } else {
          // No addon specified
          logger.error('❌ Please specify an addon name or use --all');
          logger.info('');
          logger.info('Examples:');
          logger.info('  tapi addon update linter');
          logger.info('  tapi addon update --all');
          process.exit(1);
        }

      } catch (error) {
        logger.error(`❌ Update failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



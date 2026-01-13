import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon recover` command used to inspect and remediate addon failures.
 *
 * @param program - Commander instance to extend.
 */
export default function(program: Command): void {
  program
    .command('recover')
    .description('Recover from addon errors and restore system stability')
    .option('-a, --all', 'Recover all failed addons')
    .option('--clear-errors', 'Clear all error records')
    .action(async (options) => {
      showBanner(false);

      try {
        logger.heading('Addon Recovery Tool');

        const addonManager = getAddonManager();
        
        if (options.clearErrors) {
          // Clear all error records
          logger.info('Clearing all addon error records...');
          const allErrors = addonManager.getAllAddonErrors();
          
          for (const addonName of allErrors.keys()) {
            addonManager.clearAddonErrors(addonName);
          }
          
          logger.success('Cleared all error records');
          return;
        }

        if (options.all) {
          // Attempt to recover all failed addons
          logger.info('Attempting to recover all failed addons...');
          
          const allErrors = addonManager.getAllAddonErrors();
          const failedAddons = Array.from(allErrors.keys());
          
          if (failedAddons.length === 0) {
            logger.info('No failed addons found');
            return;
          }
          
          logger.info(`Found ${failedAddons.length} addon(s) with errors: ${failedAddons.join(', ')}`);
          
          let recovered = 0;
          let stillFailed = 0;
          
          for (const addonName of failedAddons) {
            try {
              logger.info(`Attempting to recover: ${addonName}`);
              
              // Try to enable the addon (this will trigger a reload)
              await addonManager.enableAddon(addonName);
              
              // Clear the error record if successful
              addonManager.clearAddonErrors(addonName);
              recovered++;
              
              logger.success(`Recovered: ${addonName}`);
            } catch (error) {
              stillFailed++;
              logger.warn(`Still failing: ${addonName} (${error instanceof Error ? error.message : 'unknown error'})`);
            }
          }
          
          logger.info('');
          logger.info('Recovery summary:');
          logger.success(`Recovered: ${recovered} addon(s)`);
          logger.warn(`Still failing: ${stillFailed} addon(s)`);
          
          if (stillFailed > 0) {
            logger.info('');
            logger.info('For persistent failures:');
            logger.info('  - Check addon documentation for requirements');
            logger.info('  - Try reinstalling: tapi addon uninstall <name> && tapi addon install <name>');
            logger.info('  - Report issues to addon maintainers');
          }
          
        } else {
          // Show recovery options
          logger.info('Addon Error Analysis');
          
          const allErrors = addonManager.getAllAddonErrors();
          
          if (allErrors.size === 0) {
            logger.info('No addon errors found');
            logger.info('');
            logger.info('Your addon system is healthy!');
            return;
          }
          
          logger.info(`Found errors in ${allErrors.size} addon(s):`);
          logger.info('');
          
          for (const [addonName, errors] of allErrors) {
            logger.info(`${addonName}:`);
            for (const error of errors) {
              logger.info(`  - ${error}`);
            }
            logger.info('');
          }
          
          logger.info('Recovery Options:');
          logger.info('  - Recover all: tapi addon recover --all');
          logger.info('  - Clear errors: tapi addon recover --clear-errors');
          logger.info('  - Disable problematic addons: tapi addon disable <name>');
          logger.info('  - Reinstall addons: tapi addon uninstall <name> && tapi addon install <name>');
        }

      } catch (error) {
        logger.error(`Recovery failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



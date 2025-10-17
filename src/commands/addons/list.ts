import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon list` command for enumerating installed and available addons.
 *
 * @param program - Commander instance to augment.
 */
export default function(program: Command): void {
  program
    .command('list')
    .description('List installed tapi addons')
    .option('-a, --all', 'Show all addons (installed and available)')
    .option('-e, --enabled', 'Show only enabled addons')
    .option('-d, --disabled', 'Show only disabled addons')
    .action(async (options) => {
      showBanner(false);

      try {
        const addonManager = getAddonManager();
        
        if (options.all) {
          logger.heading('📦 All available addons:');
          
          // Show installed addons
          const installedAddons = await addonManager.listAddons();
          if (installedAddons.length > 0) {
            logger.info('Installed:');
            for (const addon of installedAddons) {
              const status = addon.enabled ? '✅' : '⏸️';
              const version = addon.version ? ` v${addon.version}` : '';
              logger.info(`  ${status} ${addon.name}${version} - ${addon.description}`);
            }
            logger.info('');
          }

          // Show available addons from registry
          logger.info('Available addons:');
          try {
            const availableAddons = await addonManager.searchAddons('');
            if (availableAddons.length > 0) {
              for (const addon of availableAddons) {
                logger.info(`  📦 ${addon.name} - ${addon.description || 'No description available'}`);
              }
            } else {
              logger.info('  No addons available in registry');
            }
          } catch (error) {
            logger.warn(`⚠️ Could not load available addons: ${error instanceof Error ? error.message : 'unknown error'}`);
            logger.info('  Run "tapi addon install <addon>" to install specific addons');
          }
          
        } else {
          logger.heading('📦 Installed addons:');
          
          const installedAddons = await addonManager.listAddons();
          
          if (installedAddons.length === 0) {
            logger.info('No addons installed.');
            logger.info('Run "tapi addon install <name>" to install an addon.');
            return;
          }

          // Filter based on options
          let filteredAddons = installedAddons;
          
          if (options.enabled) {
            filteredAddons = installedAddons.filter(addon => addon.enabled);
          } else if (options.disabled) {
            filteredAddons = installedAddons.filter(addon => !addon.enabled);
          }

          // Display addons
          for (const addon of filteredAddons) {
            const status = addon.enabled ? '✅ Enabled' : '⏸️ Disabled';
            const version = addon.version ? ` v${addon.version}` : '';
            
            logger.info(`📦 ${addon.name}${version}`);
            logger.info(`   ${status}`);
            logger.info(`   ${addon.description}`);
            
            if (addon.author) {
              logger.info(`   Author: ${addon.author}`);
            }
            
            if (addon.license) {
              logger.info(`   License: ${addon.license}`);
            }
            
            logger.info('');
          }

          logger.info(`Total: ${filteredAddons.length} addon(s)`);

          // Show command conflicts if any
          const hasConflicts = addonManager.hasCommandConflicts();
          if (hasConflicts) {
            logger.warn('\n⚠️ Command conflicts detected:');
            const conflicts = addonManager.getCommandConflicts();
            for (const [commandName, conflictingAddons] of conflicts) {
              logger.warn(`  ${commandName}: ${conflictingAddons.length} addons trying to override`);
              for (const addon of conflictingAddons) {
                logger.warn(`    - ${addon.name} (priority: ${addon.priority || 0})`);
              }
            }
          }

          // Show command statistics
          const stats = addonManager.getCommandStats();
          if (stats.totalAddonCommands > 0) {
            logger.info(`\n📊 Command Statistics:`);
            logger.info(`  Total addon commands: ${stats.totalAddonCommands}`);
            logger.info(`  Overridden commands: ${stats.overriddenCommands.length}`);
            logger.info(`  New commands: ${stats.newCommands.length}`);
            if (stats.conflicts > 0) {
              logger.warn(`  Conflicts: ${stats.conflicts}`);
            }
          }
        }

      } catch (error) {
        logger.error(`❌ Failed to list addons: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';
import type { AddonManager } from '../../core/addons/manager';

export default function (program: Command): void {
  const addonsCmd = program
    .command('addons')
    .description('Manage pawnctl addons');
  
  // Install addon command
  addonsCmd
    .command('install <addon>')
    .description('Install an addon')
    .option('--global', 'Install globally')
    .option('--dev', 'Install as development dependency')
    .action(async (addonName, options) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        logger.info(`📦 Installing addon: ${addonName}`);
        await addonManager.installAddon(addonName, options);
        logger.success(`✅ Successfully installed addon: ${addonName}`);
      } catch (error) {
        logger.error(`❌ Failed to install addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Uninstall addon command
  addonsCmd
    .command('uninstall <addon>')
    .description('Uninstall an addon')
    .option('--global', 'Uninstall from global location')
    .action(async (addonName, options) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        logger.info(`🗑️ Uninstalling addon: ${addonName}`);
        await addonManager.uninstallAddon(addonName, options);
        logger.success(`✅ Successfully uninstalled addon: ${addonName}`);
      } catch (error) {
        logger.error(`❌ Failed to uninstall addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // List addons command
  addonsCmd
    .command('list')
    .description('List installed addons')
    .option('--global', 'List global addons')
    .option('--enabled', 'Show only enabled addons')
    .option('--disabled', 'Show only disabled addons')
    .action(async (options) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        await addonManager.listAddons(options);
      } catch (error) {
        logger.error(`❌ Failed to list addons: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Enable addon command
  addonsCmd
    .command('enable <addon>')
    .description('Enable an addon')
    .action(async (addonName) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        logger.info(`🔌 Enabling addon: ${addonName}`);
        await addonManager.enableAddon(addonName);
        logger.success(`✅ Successfully enabled addon: ${addonName}`);
      } catch (error) {
        logger.error(`❌ Failed to enable addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Disable addon command
  addonsCmd
    .command('disable <addon>')
    .description('Disable an addon')
    .action(async (addonName) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        logger.info(`🔌 Disabling addon: ${addonName}`);
        await addonManager.disableAddon(addonName);
        logger.success(`✅ Successfully disabled addon: ${addonName}`);
      } catch (error) {
        logger.error(`❌ Failed to disable addon ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Search addons command
  addonsCmd
    .command('search <query>')
    .description('Search for addons')
    .option('--limit <number>', 'Limit number of results', '10')
    .action(async (query, options) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        await addonManager.searchAddons(query, parseInt(options.limit));
      } catch (error) {
        logger.error(`❌ Failed to search addons: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Info command
  addonsCmd
    .command('info <addon>')
    .description('Show addon information')
    .action(async (addonName) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        await addonManager.showAddonInfo(addonName);
      } catch (error) {
        logger.error(`❌ Failed to get addon info for ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Update command
  addonsCmd
    .command('update [addon]')
    .description('Update addons')
    .option('--all', 'Update all addons')
    .action(async (addonName, options) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        if (options.all) {
          logger.info('🔄 Updating all addons...');
          await addonManager.updateAllAddons();
        } else if (addonName) {
          logger.info(`🔄 Updating addon: ${addonName}`);
          await addonManager.updateAddon(addonName);
        } else {
          logger.error('❌ Please specify an addon name or use --all');
          process.exit(1);
        }
      } catch (error) {
        logger.error(`❌ Failed to update addons: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
  
  // Run command
  addonsCmd
    .command('run <command> [args...]')
    .description('Run an addon command')
    .action(async (commandName, args) => {
      showBanner(false);
      
      let addonManager: AddonManager | null = null;
      try {
        addonManager = getAddonManager();
      } catch (error) {
        logger.error(`❌ Failed to initialize addon manager: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
      
      try {
        await addonManager.runAddonCommand(commandName, args);
      } catch (error) {
        logger.error(`❌ Failed to run addon command: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

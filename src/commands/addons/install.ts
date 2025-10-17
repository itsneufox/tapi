import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

export default function(program: Command): void {
  program
    .command('install <addon>')
    .description('Install a tapi addon')
    .option('-g, --global', 'Install addon globally')
    .option('-s, --source <source>', 'Install from specific source (github, local)')
    .option('--github <repo>', 'Install from GitHub repository (user/repo)')
    .option('--local <path>', 'Install from local path')
    .option('--auto-deps', 'Automatically install missing dependencies')
    .action(async (addonName: string, options) => {
      showBanner(false);

      try {
        logger.heading(`📦 Installing addon: ${addonName}`);

        const addonManager = getAddonManager();
        
        let source = options.source;
        let installPath = '';

        if (options.github) {
          source = 'github';
          installPath = options.github;
        } else if (options.local) {
          source = 'local';
          installPath = options.local;
        } else if (!source) {
          logger.error('❌ No source specified. Use --github or --local to specify installation source.');
          logger.info('');
          logger.info('Examples:');
          logger.info('  tapi addon install my-addon --github user/repo');
          logger.info('  tapi addon install my-addon --local ./path/to/addon');
          process.exit(1);
        } else if (source === 'github') {
          installPath = addonName;
        } else if (source === 'local') {
          installPath = addonName;
        }

        logger.info(`📡 Source: ${source}`);
        logger.info(`📍 Path: ${installPath}`);
        
        if (options.global) {
          logger.info(`📦 Installing to: ~/.tapi/addons/ (global)`);
        } else {
          logger.info(`📦 Installing to: ./.tapi/addons/ (project-local)`);
        }

        const installedAddons = await addonManager.listAddons();
        const existingAddon = installedAddons.find(addon => addon.name === addonName);
        
        if (existingAddon) {
          if (existingAddon.installed) {
            logger.warn(`⚠️ Addon '${addonName}' is already installed`);
            logger.info('Use --force to reinstall');
            return;
          }
        }

        logger.info('⬇️ Downloading and installing addon...');
        await addonManager.installAddon(addonName, {
          source,
          path: installPath,
          global: options.global || false,
          autoDeps: options.autoDeps || false
        });

        logger.info('✅ Addon installed successfully!');
        logger.info('');
        logger.info('Next steps:');
        logger.info(`  • Run 'tapi addon list' to see installed addons`);
        logger.info(`  • Run 'tapi addon enable ${addonName}' to activate it`);
        logger.info(`  • Check the addon documentation for usage instructions`);

      } catch (error) {
        logger.error(`❌ Failed to install addon: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

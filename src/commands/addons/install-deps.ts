import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon install-deps` command that installs an addon's missing dependencies.
 *
 * @param program - Commander program instance to extend.
 */
export default function(program: Command): void {
  program
    .command('install-deps <addon>')
    .description('Install all missing dependencies for an addon')
    .option('-g, --global', 'Install dependencies globally')
    .option('--dry-run', 'Show what would be installed without actually installing')
    .action(async (addonName: string, options) => {
      showBanner(false);

      try {
        logger.heading(`Installing Dependencies: ${addonName}`);

        const addonManager = getAddonManager();
        const dependencyResolver = addonManager.getDependencyResolver();

        // Resolve dependencies
        logger.working('Resolving dependencies');
        const resolution = await dependencyResolver.resolveDependencies(addonName);

        if (resolution.missing.length === 0) {
          logger.success('All dependencies are already installed');
          return;
        }

        logger.info(`Missing dependencies: ${resolution.missing.join(', ')}`);

        if (options.dryRun) {
          logger.info('');
          logger.info('Dry run - would install:');
          for (const dep of resolution.missing) {
            logger.info(`  - ${dep}`);
          }
          logger.info('');
          logger.info('Remove --dry-run flag to actually install');
          return;
        }

        // Auto-install dependencies
        const result = await dependencyResolver.autoInstallDependencies(resolution, {
          global: options.global || false
        });

        // Report results
        logger.info('');
        if (result.installed.length > 0) {
          logger.success(`Successfully installed ${result.installed.length} dependencies:`);
          for (const dep of result.installed) {
            logger.info(`  - ${dep}`);
          }
        }

        if (result.failed.length > 0) {
          logger.warn(`Failed to install ${result.failed.length} dependencies:`);
          for (const dep of result.failed) {
            logger.warn(`  - ${dep}`);
          }
        }

        // Check for remaining conflicts
        if (resolution.conflicts.length > 0) {
          logger.warn('');
          logger.warn('Dependency conflicts remain:');
          for (const conflict of resolution.conflicts) {
            logger.warn(`  - ${conflict.addon}: ${conflict.reason}`);
          }
        }

        // Final validation
        logger.info('');
        logger.working('Final dependency validation');
        const validation = addonManager.validateDependencies(addonName);
        
        if (validation.valid) {
          logger.success('All dependencies are now satisfied!');
        } else {
          logger.warn('Some dependency issues remain:');
          for (const issue of validation.issues) {
            logger.warn(`  - ${issue}`);
          }
        }

      } catch (error) {
        logger.error(`Dependency installation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



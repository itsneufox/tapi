import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { getAddonManager } from '../../core/addons';

/**
 * Register the `addon deps` command for inspecting and validating addon dependencies.
 *
 * @param program - Commander program instance to extend.
 */
export default function(program: Command): void {
  program
    .command('deps <addon>')
    .description('Manage addon dependencies')
    .option('--check', 'Check dependency status')
    .option('--resolve', 'Resolve and show dependency tree')
    .option('--validate', 'Validate all dependencies are satisfied')
    .action(async (addonName, options) => {
      showBanner(false);

      try {
        const addonManager = getAddonManager();
        const dependencyResolver = addonManager.getDependencyResolver();

        if (options.check) {
          // Check dependency status
          logger.heading(`Dependency Status: ${addonName}`);
          
          const validation = addonManager.validateDependencies(addonName);
          
          if (validation.valid) {
            logger.success('All dependencies are satisfied');
          } else {
            logger.warn('Dependency issues found:');
            for (const issue of validation.issues) {
              logger.warn(`  - ${issue}`);
            }
          }
          
        } else if (options.resolve) {
          // Resolve dependency tree
          logger.heading(`Dependency Tree: ${addonName}`);
          
          const resolution = await dependencyResolver.resolveDependencies(addonName);
          
          logger.info(`Resolved addons: ${resolution.resolved.join(', ')}`);
          
          if (resolution.conflicts.length > 0) {
            logger.warn('Conflicts detected:');
            for (const conflict of resolution.conflicts) {
              logger.warn(`  - ${conflict.addon}: ${conflict.reason}`);
            }
          }
          
          if (resolution.versionConflicts.length > 0) {
            logger.warn('Version conflicts detected:');
            for (const versionConflict of resolution.versionConflicts) {
              logger.warn(`  - ${versionConflict.addon}: ${versionConflict.reason}`);
              logger.warn(`    Available: ${versionConflict.availableVersion}`);
              logger.warn(`    Required: ${versionConflict.constraint}`);
            }
          }
          
          if (resolution.missing.length > 0) {
            logger.warn('Missing dependencies:');
            for (const missing of resolution.missing) {
              logger.warn(`  - ${missing}`);
            }
          }
          
          // Show installation order
          const order = dependencyResolver.getInstallationOrder(resolution);
          if (order.length > 0) {
            logger.info('');
            logger.info('Recommended installation order:');
            for (let i = 0; i < order.length; i++) {
              logger.info(`  ${i + 1}. ${order[i]}`);
            }
          }
          
          // Show suggestions
          const suggestions = dependencyResolver.suggestSolutions(resolution);
          if (suggestions.length > 0) {
            logger.info('');
            logger.info('Suggested solutions:');
            for (const suggestion of suggestions) {
              logger.info(`  - ${suggestion}`);
            }
          }
          
        } else if (options.validate) {
          // Validate all dependencies
          logger.heading('Validating All Addon Dependencies');
          
          const addons = await addonManager.listAddons();
          let validCount = 0;
          let invalidCount = 0;
          
          for (const addon of addons) {
            const validation = addonManager.validateDependencies(addon.name);
            if (validation.valid) {
              validCount++;
              logger.detail(`${addon.name}`);
            } else {
              invalidCount++;
              logger.warn(`${addon.name}:`);
              for (const issue of validation.issues) {
                logger.warn(`    - ${issue}`);
              }
            }
          }
          
          logger.info('');
          logger.info('Validation summary:');
          logger.success(`Valid addons: ${validCount}`);
          logger.warn(`Invalid addons: ${invalidCount}`);
          
          if (invalidCount > 0) {
            logger.info('');
            logger.hint('Use "tapi addon deps <name> --resolve" to get solutions');
          }
          
        } else {
          // Show dependency information
          logger.heading(`Dependencies: ${addonName}`);
          
          const addonInfo = addonManager.getLoader().getAddonInfo(addonName);
          if (!addonInfo) {
            logger.error(`Addon not found: ${addonName}`);
            process.exit(1);
          }
          
          if (addonInfo.dependencies && addonInfo.dependencies.length > 0) {
            logger.info('Dependencies:');
            for (const dep of addonInfo.dependencies) {
              const depInfo = addonManager.getLoader().getAddonInfo(dep);
              if (depInfo) {
                const status = depInfo.enabled ? '[ENABLED]' : '[DISABLED]';
                logger.info(`  ${status} ${dep} (${depInfo.version})`);
              } else {
                logger.warn(`  Missing addon: ${dep}`);
              }
            }
          } else {
            logger.info('No dependencies');
          }
          
          logger.info('');
          logger.info('Options:');
          logger.info('  --check      Check if all dependencies are satisfied');
          logger.info('  --resolve    Show full dependency tree and conflicts');
          logger.info('  --validate   Validate all addon dependencies');
        }

      } catch (error) {
        logger.error(`Dependency operation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

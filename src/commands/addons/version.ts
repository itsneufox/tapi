import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { SemVer } from '../../core/addons/semver';

/**
 * Register the `addon version` utility command that exposes semver helpers.
 *
 * @param program - Commander instance to augment.
 */
export default function(program: Command): void {
  program
    .command('version')
    .description('Semantic versioning utilities for addons')
    .option('--check <version> <constraint>', 'Check if version satisfies constraint')
    .option('--compare <version1> <version2>', 'Compare two versions')
    .option('--validate <version>', 'Validate version format')
    .option('--constraint <constraint>', 'Validate constraint format')
    .action(async (options) => {
      showBanner(false);

      try {
        if (options.check) {
          // Parse check arguments
          const args = options.check.split(' ');
          if (args.length !== 2) {
            logger.error('Usage: --check <version> <constraint>');
            process.exit(1);
          }
          
          const [version, constraint] = args;
          
          logger.heading('Version Constraint Check');
          logger.info(`Version: ${version}`);
          logger.info(`Constraint: ${constraint}`);
          
          if (!SemVer.isValidVersion(version)) {
            logger.error(`Invalid version format: ${version}`);
            process.exit(1);
          }
          
          if (!SemVer.isValidConstraint(constraint)) {
            logger.error(`Invalid constraint format: ${constraint}`);
            process.exit(1);
          }
          
          const satisfies = SemVer.satisfies(version, constraint);
          
          if (satisfies) {
            logger.success(`Version ${version} satisfies constraint ${constraint}`);
          } else {
            logger.warn(`Version ${version} does NOT satisfy constraint ${constraint}`);
          }
          
        } else if (options.compare) {
          // Parse compare arguments
          const args = options.compare.split(' ');
          if (args.length !== 2) {
            logger.error('Usage: --compare <version1> <version2>');
            process.exit(1);
          }
          
          const [version1, version2] = args;
          
          logger.heading('Version Comparison');
          
          if (!SemVer.isValidVersion(version1)) {
            logger.error(`Invalid version format: ${version1}`);
            process.exit(1);
          }
          
          if (!SemVer.isValidVersion(version2)) {
            logger.error(`Invalid version format: ${version2}`);
            process.exit(1);
          }
          
          const comparison = SemVer.compare(version1, version2);
          
          logger.info(`Version 1: ${version1}`);
          logger.info(`Version 2: ${version2}`);
          
          if (comparison === 0) {
            logger.info('Result: Versions are equal');
          } else if (comparison > 0) {
            logger.info(`Result: ${version1} is greater than ${version2}`);
          } else {
            logger.info(`Result: ${version1} is less than ${version2}`);
          }
          
        } else if (options.validate) {
          // Validate version format
          logger.heading('Version Validation');
          
          const isValid = SemVer.isValidVersion(options.validate);
          
          if (isValid) {
            logger.success(`Valid version format: ${options.validate}`);
          } else {
            logger.error(`Invalid version format: ${options.validate}`);
            logger.info('Expected format: major.minor.patch[-prerelease][+build]');
            logger.info('Examples: 1.0.0, 2.1.3-beta.1, 3.0.0-alpha.1+build.123');
          }
          
        } else if (options.constraint) {
          // Validate constraint format
          logger.heading('Constraint Validation');
          
          const isValid = SemVer.isValidConstraint(options.constraint);
          
          if (isValid) {
            logger.success(`Valid constraint format: ${options.constraint}`);
            logger.info('Supported operators: ^, ~, >=, <=, >, <, =');
            logger.info('Examples: ^1.0.0, ~2.1.0, >=1.0.0 <2.0.0');
          } else {
            logger.error(`Invalid constraint format: ${options.constraint}`);
            logger.info('Supported operators: ^, ~, >=, <=, >, <, =');
            logger.info('Examples: ^1.0.0, ~2.1.0, >=1.0.0 <2.0.0');
          }
          
        } else {
          // Show help
          logger.heading('Semantic Versioning Utilities');
          logger.info('');
          logger.info('Commands:');
          logger.info('  --check <version> <constraint>    Check if version satisfies constraint');
          logger.info('  --compare <version1> <version2>   Compare two versions');
          logger.info('  --validate <version>             Validate version format');
          logger.info('  --constraint <constraint>        Validate constraint format');
          logger.info('');
          logger.info('Examples:');
          logger.info('  tapi addon version --check 1.2.3 "^1.0.0"');
          logger.info('  tapi addon version --compare 1.2.3 1.2.4');
          logger.info('  tapi addon version --validate 1.2.3-beta.1');
          logger.info('  tapi addon version --constraint ">=1.0.0 <2.0.0"');
          logger.info('');
          logger.info('Supported constraint operators:');
          logger.info('  ^1.0.0    Compatible within major version');
          logger.info('  ~1.2.3    Compatible within minor version');
          logger.info('  >=1.0.0   Greater than or equal');
          logger.info('  <=2.0.0   Less than or equal');
          logger.info('  >1.0.0    Greater than');
          logger.info('  <2.0.0    Less than');
          logger.info('  =1.0.0    Exact version');
          logger.info('  >=1.0.0 <2.0.0  Range constraints');
        }

      } catch (error) {
        logger.error(`Version operation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}



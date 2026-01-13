import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';

// Import subcommands
import installCommand from './install';
import uninstallCommand from './uninstall';
import listCommand from './list';
import enableCommand from './enable';
import disableCommand from './disable';
import recoverCommand from './recover';
import updateCommand from './update';
import depsCommand from './deps';
import installDepsCommand from './install-deps';
import versionCommand from './version';

/**
 * Register the `addon` top-level command and all associated subcommands.
 *
 * @param program - Commander instance to augment.
 */
export default function(program: Command): void {
  const addonCommand = program
    .command('addon')
    .description('Manage tapi addons');

  // Install subcommand
  installCommand(addonCommand);

  // Uninstall subcommand
  uninstallCommand(addonCommand);

  // List subcommand
  listCommand(addonCommand);

  // Enable subcommand
  enableCommand(addonCommand);

  // Disable subcommand
  disableCommand(addonCommand);

  // Recover subcommand
  recoverCommand(addonCommand);

  // Update subcommand
  updateCommand(addonCommand);

  // Dependencies subcommand
  depsCommand(addonCommand);

  // Install dependencies subcommand
  installDepsCommand(addonCommand);

  // Version utilities subcommand
  versionCommand(addonCommand);

  // Show help if no subcommand provided
  addonCommand.action(() => {
    showBanner(false);
    logger.info('Addon management commands:');
    logger.info('');
    logger.info('  install <addon>     Install an addon');
    logger.info('  uninstall <addon>   Remove an addon');
    logger.info('  list                List installed addons');
    logger.info('  enable <addon>      Enable a disabled addon');
    logger.info('  disable <addon>     Disable an addon');
    logger.info('  recover             Recover from addon errors');
    logger.info('  update [addon]      Update addons to latest versions');
    logger.info('  deps <addon>        Manage addon dependencies');
    logger.info('  install-deps <addon> Install all missing dependencies');
    logger.info('  version             Semantic versioning utilities');
    logger.info('');
    logger.info('Examples:');
    logger.info('  tapi addon install linter --auto-deps');
    logger.info('  tapi addon install-deps my-addon --dry-run');
    logger.info('  tapi addon deps linter --resolve');
    logger.info('  tapi addon version --check 1.2.3 "^1.0.0"');
    logger.info('  tapi addon list');
  });
}

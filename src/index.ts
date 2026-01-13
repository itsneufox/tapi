#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands';
import { logger } from './utils/logger';
import { showBanner } from './utils/banner';
import { configManager } from './utils/config';
import { setupWizard } from './commands/setup/setup';
import { showUpdateNotification } from './utils/updateChecker';

/**
 * CLI entry point: configure Commander, register commands, and orchestrate first-run setup.
 */
async function main() {
  const program = new Command();
  program
    .name('tapi')
    .description('Package manager and build tool for open.mp/SA-MP development')
    .version('1.0.0-alpha.1')
    .option('-v, --verbose', 'show detailed debug output')
    .option('-q, --quiet', 'minimize console output (show only progress bars)')
    .option('--log-to-file', 'save logs to file')
    .hook('preAction', (thisCommand) => {
      const options = thisCommand.opts();

      if (options.logToFile) {
        logger.enableFileLogging();
        
        // Log the command that was executed
        const commandLine = process.argv.join(' ');
        logger.info(`Command executed: ${commandLine}`);
      }

      if (options.verbose) {
        logger.setVerbosity('verbose');
      } else if (options.quiet) {
        logger.setVerbosity('quiet');
      } else {
        logger.setVerbosity('normal');
      }
    });

  registerCommands(program);

  const isFirstRun = !configManager.isSetupComplete();
  const isSetupCommand = process.argv.includes('setup');
  const isVersionCommand =
    process.argv.includes('-V') || process.argv.includes('--version');
  const isHelpCommand =
    process.argv.includes('-h') ||
    process.argv.includes('--help') ||
    process.argv.length <= 2;

  if (isFirstRun || isSetupCommand || isHelpCommand) {
    showBanner(true);
  }

  if (isFirstRun && !isHelpCommand && !isVersionCommand && !isSetupCommand) {
    logger.info('This appears to be your first time using tapi.');
    logger.info("Let's configure some basic settings before proceeding.");
    logger.newline();

    const setupComplete = await setupWizard(false);

    if (!setupComplete) {
      logger.error('Setup must be completed before using tapi.');
      process.exit(1);
    }
  }

  program.parse(process.argv);

  if (!process.argv.slice(2).length && !isFirstRun) {
    program.outputHelp();
  }
  
  // Show update notification (checks once per day, shows reminder every run if update available)
  if (!isHelpCommand && !isVersionCommand) {
    showUpdateNotification().catch(() => {
      // Silently fail update checks
    });
  }
}

main().catch((err) => {
  logger.error(
    `Fatal error: ${err instanceof Error ? err.message : 'unknown error'}`
  );
  process.exit(1);
});

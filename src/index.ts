#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands';
import { logger } from './utils/logger';
import { showBanner } from './utils/banner';
import { configManager } from './utils/config';
import { setupWizard } from './commands/setup/setup';

async function main() {
  const program = new Command();
  
  registerCommands(program);

  const isFirstRun = !configManager.isSetupComplete();
  const isSetupCommand = process.argv.includes('setup');
  const isVersionCommand = process.argv.includes('-V') || process.argv.includes('--version');
  const isHelpCommand = process.argv.includes('-h') || process.argv.includes('--help') || 
                         process.argv.length <= 2;

  if (isFirstRun || isSetupCommand || isHelpCommand) {
    showBanner(true);
  }

  if (isFirstRun && !isHelpCommand && !isVersionCommand && !isSetupCommand) {
    logger.info('This appears to be your first time using pawnctl.');
    logger.info('Let\'s configure some basic settings before proceeding.');
    logger.newline();
    
    const setupComplete = await setupWizard(false);
    
    if (!setupComplete) {
      logger.error('Setup must be completed before using pawnctl.');
      process.exit(1);
    }
  }

  program.parse(process.argv);

  if (!process.argv.slice(2).length && !isFirstRun) {
    program.outputHelp();
  }
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
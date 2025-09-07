#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommands } from './commands';
import { logger } from './utils/logger';
import { showBanner } from './utils/banner';
import { configManager } from './utils/config';
import { setupWizard } from './commands/setup/setup';
import { showUpdateNotification } from './utils/updateChecker';
import { getVersion } from './utils/version';

function handleSampctlCompatibility() {
  const args = process.argv.slice(2);
  
  // Command mapping
  const commandMap: Record<string, string[]> = {
    'package init': ['init'],
    'package build': ['build'], 
    'package run': ['start'],
    'package get': ['install'],
    'package install': ['install'],
  };
  
  const commandStr = args.join(' ');
  
  // Check for mappings
  for (const [sampctlCmd, pawnctlArgs] of Object.entries(commandMap)) {
    if (commandStr.startsWith(sampctlCmd)) {
      console.log(`🔄 sampctl → pawnctl ${pawnctlArgs.join(' ')}`);
      
      // Get remaining args after the mapped command
      const remainingArgs = args.slice(sampctlCmd.split(' ').length);
      const finalArgs = [...pawnctlArgs, ...remainingArgs];
      
      // Handle runtime flag conversion
      if (finalArgs.includes('--runtime')) {
        const runtimeIndex = finalArgs.indexOf('--runtime');
        const runtime = finalArgs[runtimeIndex + 1];
        
        // Remove --runtime args
        finalArgs.splice(runtimeIndex, 2);
        
        // Add pawnctl equivalent
        if (runtime === 'samp' && finalArgs[0] === 'init') {
          finalArgs.push('--legacy-samp');
        }
      }
      
      // Replace process.argv and continue with pawnctl logic
      process.argv = [process.argv[0], process.argv[1], ...finalArgs];
      return true; // Continue with normal pawnctl execution
    }
  }
  
  // Show help if no mapping found
  console.log('🔄 sampctl compatibility mode');
  console.log('');
  console.log('Available commands:');
  console.log('  sampctl package init     → pawnctl init');
  console.log('  sampctl package build    → pawnctl build');
  console.log('  sampctl package run      → pawnctl start');
  console.log('  sampctl package get <pkg> → pawnctl install <pkg>');
  console.log('');
  console.log('Example: sampctl package init --runtime samp');
  return false; // Exit, don't continue
}

async function main() {
  // Check if running as sampctl (through symlink, alias, or file copy)
  const isRunningAsSampctl = process.argv[0].includes('sampctl') || 
                            process.argv[1].includes('sampctl') ||
                            process.env.SAMPCTL_COMPAT === 'true';

  if (isRunningAsSampctl) {
    const shouldContinue = handleSampctlCompatibility();
    if (!shouldContinue) {
      return;
    }
  }

  const program = new Command();
  
  program
    .name(isRunningAsSampctl ? 'sampctl' : 'pawnctl')
    .description(isRunningAsSampctl ? 
      'sampctl compatibility layer for pawnctl' : 
      'Package manager and build tool for open.mp/SA-MP development')
    .version(getVersion())
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
    logger.info('🎉 This appears to be your first time using pawnctl.');
    logger.info("Let's configure some basic settings before proceeding.");
    logger.newline();

    const setupComplete = await setupWizard(false);

    if (!setupComplete) {
      logger.error('❌ Setup must be completed before using pawnctl.');
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
    `❌ Fatal error: ${err instanceof Error ? err.message : 'unknown error'}`
  );
  process.exit(1);
});

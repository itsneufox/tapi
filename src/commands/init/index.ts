import { Command } from 'commander';
import { setupInitCommand } from './setup';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';

export default function (program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .option('-q, --quiet', 'minimize console output (show only progress bars)')
    .option('-v, --verbose', 'show detailed debug output')
    .option('--log-to-file [path]', 'save logs to file (optional custom path)')
    .action(async (options) => {
      // Handle logging setup FIRST, before any other output
      if (options.logToFile) {
        const logPath =
          typeof options.logToFile === 'string' ? options.logToFile : undefined;
        logger.enableFileLogging(logPath);
      }

      // Handle verbosity
      if (options.quiet) {
        logger.setVerbosity('quiet');
      } else if (options.verbose) {
        logger.setVerbosity('verbose');
      }

      // Now show banner and run setup
      showBanner(options.quiet);

      // run the init setup process
      await setupInitCommand(options);
    });
}

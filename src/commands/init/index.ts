import { Command } from 'commander';
import { setupInitCommand } from './setup';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';

export default function(program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .option('-q, --quiet', 'minimize console output (show only progress bars)')
    .option('-v, --verbose', 'show detailed debug output')
    .action(async (options) => {
      // set verbosity based on flags
      if (options.quiet) {
        logger.setVerbosity('quiet');
      } else if (options.verbose) {
        logger.setVerbosity('verbose');
      } else {
        logger.setVerbosity('normal');
      }

      showBanner(false);
      
      // run the init setup process
      await setupInitCommand(options);
    });
}
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
    .action(async (options) => {
      showBanner(false);

      // run the init setup process
      await setupInitCommand(options);
    });
}

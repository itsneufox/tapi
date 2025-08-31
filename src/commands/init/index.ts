import { Command } from 'commander';
import { setupInitCommand } from './setup';
import { showBanner } from '../../utils/banner';

export default function (program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .option('-q, --quiet', 'minimize console output (show only progress bars)')
    .option('--skip-compiler', 'skip compiler setup and use default settings')
    .action(async (options) => {
      // Now show banner and run setup
      showBanner(options.quiet);

      // run the init setup process
      await setupInitCommand(options);
    });
}

import { Command } from 'commander';
import { setupInitCommand } from './setup';

/**
 * Register the `init` command that bootstraps a new project via the setup wizard.
 *
 * @param program - Commander instance to extend.
 */
export default function (program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .option('-q, --quiet', 'minimize console output (show only progress bars)')
    .option('--skip-compiler', 'skip compiler setup and use default settings')
    .option('--legacy-samp', 'initialize with SA-MP legacy support')
    .option('--preset <preset>', 'use preset file or preset name from ~/.tapi/workflows')
    .option('--accept-preset', 'apply preset values without prompts')
    .option('--non-interactive', 'skip all prompts; requires preset or CLI values')
    .action(async (options) => {
      // run the init setup process
      await setupInitCommand(options);
    });
}

import { Argument, Command, Option } from 'commander';
import { logger } from '../../utils/logger';

function onInstallCommand(repo: string, options: {
  quiet: boolean,
  verbose: boolean,
  dependencies: boolean
}): void {
    if (options.quiet) {
      logger.setVerbosity('quiet');
    } else if (options.verbose) {
      logger.setVerbosity('verbose');
    } else {
      logger.setVerbosity('normal');
    }

    console.log(repo);
    console.log(options);
}

const repoMatcher = new RegExp("^([a-zA-Z0-9-_\.]+)/([a-zA-Z0-9-_\.]+)$");

export default function (program: Command): void {
  program
    .command('install')
    .description('Installs a include or plugin into the project')
    .addArgument(new Argument('<repo>', 'github repository to install')
      .argParser((value) => {
        //TODO: add support for git links 
        const match = repoMatcher.exec(value);
        if (match === null) {
          logger.error('Invalid repository format. Expected format: <owner>/<repo>');
          process.exit(1);
        }

        return { owner: match[1], repository: match[2] };
      })
      .argRequired()
    )
    .option('--no-dependencies', 'do not install dependencies')
    .addOption(new Option('-q, --quiet', 'minimize console output (show only progress bars)').conflicts('verbose'))
    .addOption(new Option('--verbose', 'show detailed debug output').conflicts('quiet'))
    .action(onInstallCommand)
}
import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';

async function showCurrentConfig(): Promise<void> {
  logger.info('Current pawnctl configuration:');

  const config = configManager.getFullConfig();
  logger.plain(`• Default author: ${config.defaultAuthor || '(not set)'}`);
  logger.plain(`• Preferred editor: ${config.editor || '(not set)'}`);
  logger.plain(
    `• GitHub integration: ${config.githubToken ? 'Configured' : 'Not configured'}`
  );
  logger.plain(`• Setup complete: ${config.setupComplete ? 'Yes' : 'No'}\n`);
}

async function configureAuthor(): Promise<void> {
  const currentAuthor = configManager.getDefaultAuthor();

  const author = await input({
    message: 'Enter your default author name:',
    default: currentAuthor || '',
  });

  configManager.setDefaultAuthor(author);
  logger.success(`Default author updated to: ${author}`);
}

async function configureEditor(): Promise<void> {
  const currentEditor = configManager.getEditor();

  const editor = (await select({
    message: 'Which code editor do you use most for PAWN development?',
    choices: [
      { value: 'VS Code', name: 'Visual Studio Code (recommended)' },
      { value: 'Sublime Text', name: 'Sublime Text' },
      { value: 'Other/None', name: 'Other editor or none' },
    ],
    default: currentEditor || 'VS Code',
  })) as 'VS Code' | 'Sublime Text' | 'Other/None';

  configManager.setEditor(editor);
  logger.success(`Preferred editor updated to: ${editor}`);
}

async function configureGitHub(): Promise<void> {
  const hasToken = !!configManager.getGitHubToken();

  if (hasToken) {
    const action = await select({
      message: 'GitHub token is already configured. What would you like to do?',
      choices: [
        { value: 'update', name: 'Update the token' },
        { value: 'remove', name: 'Remove the token' },
        { value: 'keep', name: 'Keep current token' },
      ],
    });

    if (action === 'update') {
      const token = await input({
        message: 'Enter your new GitHub personal access token:',
        default: '',
      });

      if (token) {
        configManager.setGitHubToken(token);
        logger.success('GitHub token updated successfully');
      } else {
        logger.info('GitHub token update cancelled');
      }
    } else if (action === 'remove') {
      configManager.setGitHubToken('');
      logger.success('GitHub token removed');
    } else {
      logger.info('GitHub token unchanged');
    }
  } else {
    const token = await input({
      message:
        'Enter your GitHub personal access token (optional, press Enter to skip):',
      default: '',
    });

    if (token) {
      configManager.setGitHubToken(token);
      logger.success('GitHub token configured successfully');
    } else {
      logger.info('GitHub token configuration skipped');
    }
  }
}

async function resetConfiguration(): Promise<void> {
  const confirm = await input({
    message:
      'This will reset ALL configuration to defaults. Type "confirm" to proceed:',
    default: '',
  });

  if (confirm.toLowerCase() === 'confirm') {
    configManager.reset();
    logger.success('Configuration reset to defaults');
    logger.info(
      'You will need to run "pawnctl setup" again before using pawnctl'
    );
  } else {
    logger.info('Configuration reset cancelled');
  }
}

async function interactiveConfig(): Promise<void> {
  while (true) {
    await showCurrentConfig();

    const action = await select({
      message: 'What would you like to configure?',
      choices: [
        { value: 'author', name: 'Default author name' },
        { value: 'editor', name: 'Preferred code editor' },
        { value: 'github', name: 'GitHub integration' },
        { value: 'reset', name: 'Reset all settings' },
        { value: 'exit', name: 'Exit configuration' },
      ],
    });

    switch (action) {
      case 'author':
        await configureAuthor();
        break;
      case 'editor':
        await configureEditor();
        break;
      case 'github':
        await configureGitHub();
        break;
      case 'reset':
        await resetConfiguration();
        return; // exit after reset
      case 'exit':
        logger.info('Configuration complete!');
        return;
    }

    logger.plain(''); // add spacing between iterations
  }
}

export default function (program: Command): void {
  program
    .command('config')
    .description('Configure pawnctl settings')
    .option('--show', 'show current configuration and exit')
    .option('--author [name]', 'set default author name')
    .option(
      '--editor <editor>',
      'set preferred editor (VS Code, Sublime Text, Other/None)'
    )
    .option('--github-token [token]', 'set GitHub personal access token')
    .option('--reset', 'reset all configuration to defaults')
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
      if (options.verbose) {
        logger.setVerbosity('verbose');
      }

      showBanner(false);

      try {
        // handle individual options
        if (options.show) {
          await showCurrentConfig();
          return;
        }

        if (options.reset) {
          await resetConfiguration();
          return;
        }

        if (options.author !== undefined) {
          if (options.author === true) {
            // --author flag without value, prompt for it
            await configureAuthor();
          } else {
            // --author with value
            configManager.setDefaultAuthor(options.author);
            logger.success(`Default author set to: ${options.author}`);
          }
          return;
        }

        if (options.editor) {
          const validEditors = ['VS Code', 'Sublime Text', 'Other/None'];
          if (validEditors.includes(options.editor)) {
            configManager.setEditor(
              options.editor as 'VS Code' | 'Sublime Text' | 'Other/None'
            );
            logger.success(`Preferred editor set to: ${options.editor}`);
          } else {
            logger.error(
              `Invalid editor. Valid options: ${validEditors.join(', ')}`
            );
            process.exit(1);
          }
          return;
        }

        if (options.githubToken !== undefined) {
          if (options.githubToken === true) {
            // --github-token flag without value, prompt for it
            await configureGitHub();
          } else {
            // --github-token with value
            configManager.setGitHubToken(options.githubToken);
            logger.success('GitHub token configured successfully');
          }
          return;
        }

        // no options provided, start interactive mode
        await interactiveConfig();
      } catch (error) {
        logger.error(
          `Configuration failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

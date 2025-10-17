import { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';

/**
 * Run the interactive setup wizard, optionally bypassing completion checks.
 *
 * @param force - When true, re-run setup even if previously completed.
 */
export async function setupWizard(force = false): Promise<boolean> {
  if (!force && configManager.isSetupComplete()) {
    logger.info('ℹ️ Setup has already been completed.');
    logger.newline();
    logger.subheading('⚙️ Your current configuration:');
    const config = configManager.getFullConfig();
    logger.keyValue('Default author', config.defaultAuthor || '(not set)');
    logger.keyValue('Preferred editor', config.editor || '(not set)');
    logger.keyValue(
      'GitHub integration',
      config.githubToken ? 'Configured' : 'Not configured'
    );
    logger.newline();
    logger.info('💡 To force setup to run again, use: tapi setup --force');
    logger.info('💡 To edit individual settings, use: tapi config');
    logger.newline();
    return true;
  }

  logger.heading('🎉 Welcome to tapi!');
  logger.info('This one-time setup will help configure tapi for your use.');
  logger.newline();

  try {
    const author = await input({
      message:
        'What name would you like to use as the default author for your projects?',
      default: configManager.getDefaultAuthor() || '',
    });
    configManager.setDefaultAuthor(author);

    const editor = (await select({
      message: 'Which code editor do you use most for PAWN development?',
      choices: [
        { value: 'VS Code', name: 'Visual Studio Code (recommended)' },
        { value: 'Sublime Text', name: 'Sublime Text' },
        { value: 'Other/None', name: 'Other editor or none' },
      ],
      default: configManager.getEditor() || 'VS Code',
    })) as 'VS Code' | 'Sublime Text' | 'Other/None';
    configManager.setEditor(editor);

    const configureGithub = await confirm({
      message:
        'Would you like to configure GitHub integration? (for package installations)',
      default: false,
    });

    if (configureGithub) {
      const token = await input({
        message:
          'Enter your GitHub personal access token (optional, press Enter to skip):',
        default: '',
      });
      if (token) {
        configManager.setGitHubToken(token);
      }
    }

    configManager.setSetupComplete(true);

    logger.newline();
    logger.finalSuccess('✅ Setup complete! You can now use tapi.');
    logger.info('💡 To change these settings in the future, run: tapi config');

    return true;
  } catch (error) {
    logger.error(
      `❌ Setup failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return false;
  }
}

/**
 * Register the `setup` command, wrapping the interactive configuration wizard.
 *
 * @param program - Commander instance to extend.
 */
export default function (program: Command): void {
  program
    .command('setup')
    .description('Configure tapi settings')
    .option('-f, --force', 'force setup even if already configured')
    .action(async (options) => {
      showBanner(false);

      try {
        const success = await setupWizard(options.force);
        if (!success) {
          process.exit(1);
        }
      } catch (error) {
        logger.error(
          `Setup failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

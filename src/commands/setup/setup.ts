import { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
import { logger } from '../../utils/logger';

export async function setupWizard(force = false): Promise<boolean> {
  if (!force && configManager.isSetupComplete()) {
    logger.info('Setup has already been completed.\n');
    logger.info('Your current configuration:');
   
    const config = configManager.getFullConfig();
    logger.plain(`• Default author: ${config.defaultAuthor || '(not set)'}`);
    logger.plain(`• Preferred editor: ${config.editor || '(not set)'}`);
    logger.plain(`• GitHub integration: ${config.githubToken ? 'Configured' : 'Not configured'}\n`);
   
    logger.info('To force setup to run again, use: pawnctl setup --force');
    logger.info('To edit individual settings, use: pawnctl config\n');
    return true;
  }

  logger.info('Welcome to pawnctl! Let\'s set up your environment.');
  logger.info('This one-time setup will help configure pawnctl for your use.');  
  
  try {
    const author = await input({
      message: 'What name would you like to use as the default author for your projects?',
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
      message: 'Would you like to configure GitHub integration? (for package installations)',
      default: false,
    });
    
    if (configureGithub) {
      const token = await input({
        message: 'Enter your GitHub personal access token (optional, press Enter to skip):',
        default: '',
      });
      if (token) {
        configManager.setGitHubToken(token);
      }
    }
    
    configManager.setSetupComplete(true);

    logger.success('\n🎉 Setup complete! You can now use pawnctl.');
    logger.info('To change these settings in the future, run: pawnctl config');
    return true;
  } catch (error) {
    logger.error(
      `Setup failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return false;
  }
}

export default function (program: Command): void {
  program
    .command('setup')
    .description('Configure pawnctl settings')
    .option('-f, --force', 'force setup even if already configured')
    .action(async (options) => {
        await setupWizard(options.force);
    });
}
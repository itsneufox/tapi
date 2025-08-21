import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { configManager } from '../../utils/config';
import { CommandOptions, InitialAnswers, CompilerAnswers } from './types';
import { promptForInitialOptions, promptForCompilerOptions } from './prompts';
import { setupProjectStructure } from './projectStructure';
import { setupCompiler } from './compiler';
import { downloadopenmpServer } from './serverDownload';
import { cleanupGamemodeFiles, cleanupFiles, createSpinner } from './utils';

export async function setupInitCommand(options: CommandOptions): Promise<void> {
  const pawnJsonPath = path.join(process.cwd(), '.pawnctl', 'pawn.json');
  if (fs.existsSync(pawnJsonPath)) {
    logger.warn('A project already exists in this folder (pawn.json detected). Initialization aborted.');
    return;
  }

  try {
    logger.heading('Initializing new open.mp project...');

    const initialAnswers = await promptForInitialOptions(options);
    logger.newline();
    logger.subheading('Setting up your project...');

    await setupProjectStructure(initialAnswers);

    configManager.setEditor(initialAnswers.editor);
    
    if (
      initialAnswers.author &&
      initialAnswers.author !== configManager.getDefaultAuthor()
    ) {
      configManager.setDefaultAuthor(initialAnswers.author);
    }
    
    if (initialAnswers.downloadServer) {
      try {
        const directories = [
          'gamemodes',
          'filterscripts',
          'includes',
          'plugins',
          'scriptfiles',
        ];
        await downloadopenmpServer('latest', directories);
      } catch (error) {
        // Error handling inside downloadopenmpServer
      }
    }

    const compilerAnswers = await promptForCompilerOptions();
    await setupCompiler(compilerAnswers);
    await updateServerConfiguration(initialAnswers.name);
    
    const answers = {
      ...initialAnswers,
      ...compilerAnswers,
    };
    
    setTimeout(() => {
      const cleanupSpinner = createSpinner('Performing final cleanup...');

      const workingFile = `${answers.name}.pwn`;
      cleanupGamemodeFiles(workingFile);

      const qawnoDir = path.join(process.cwd(), 'qawno');
      const keepItems = ['include', 'pawncc.exe', 'pawnc.dll'];
      const removedCount = cleanupFiles(qawnoDir, keepItems);

      if (removedCount > 0) {
        cleanupSpinner.text = `Cleaned up qawno directory (removed ${removedCount} items)`;
      }

      const extractDir = path.join(process.cwd(), 'temp_extract');
      if (fs.existsSync(extractDir)) {
        let retryCount = 0;
        const maxRetries = 3;
        const retryInterval = 2000;

        const attemptRemoval = () => {
          try {
            fs.rmSync(extractDir, { recursive: true, force: true });
            cleanupSpinner.succeed('Cleanup complete');
            showSuccessInfo(answers);
            process.exit(0);
          } catch {
            retryCount++;
            if (retryCount < maxRetries) {
              cleanupSpinner.text = `Cleanup in progress (attempt ${retryCount}/${maxRetries})`;
              setTimeout(attemptRemoval, retryInterval);
            } else {
              cleanupSpinner.warn(`Could not remove extract directory after ${maxRetries} attempts`);
              logger.warn('You may need to manually delete the temp_extract directory later');
              showSuccessInfo(answers);
              process.exit(0);
            }
          }
        };

        attemptRemoval();
      } else {
        cleanupSpinner.succeed('Cleanup complete');
        showSuccessInfo(answers);
        process.exit(0);
      }
    }, 1000);
  } catch (error) {
    logger.error(`Failed to initialize project: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(1);
  }
}

async function updateServerConfiguration(projectName: string): Promise<void> {
  const configSpinner = createSpinner('Updating server configuration...');
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);

      if (config.pawn && Array.isArray(config.pawn.main_scripts)) {
        config.pawn.main_scripts = [`${projectName} 1`];

        if (config.name === 'open.mp server') {
          config.name = `${projectName} | open.mp server`;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        configSpinner.succeed('Server configuration updated');
      } else {
        configSpinner.info('No configuration update needed');
      }
    } else {
      configSpinner.info('No server configuration found');
    }
  } catch (error) {
    configSpinner.fail(`Could not update config.json: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

function showSuccessInfo(answers: InitialAnswers & CompilerAnswers): void {
  logger.newline();
  logger.finalSuccess('Project initialized successfully!');

  if (logger.getVerbosity() !== 'quiet') {
    logger.newline();
    logger.subheading('Next steps:');
    logger.list([
      `Edit your ${answers.projectType} in ${answers.projectType === 'gamemode' ? 'gamemodes/' : answers.projectType === 'filterscript' ? 'filterscripts/' : 'includes/'}${answers.name}.${answers.projectType === 'library' ? 'inc' : 'pwn'}`,
      'Run "pawnctl build" to compile your code',
      ...(answers.editor === 'VS Code' ? [
        'Press Ctrl+Shift+B in VS Code to run the build task',
        'Press F5 to start the server'
      ] : []),
      ...(answers.initGit ? [
        `Use ${answers.editor === 'VS Code' ? "VS Code's built-in Git tools" : 'Git commands'} to push to GitHub or another Git provider`
      ] : [])
    ]);
  }
}
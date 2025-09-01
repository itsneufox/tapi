import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { configManager } from '../../utils/config';
import { CommandOptions, InitialAnswers, CompilerAnswers } from './types';
import { promptForInitialOptions, promptForCompilerOptions } from './prompts';
import { confirm } from '@inquirer/prompts';
import { setupProjectStructure } from './projectStructure';
import { setupCompiler } from './compiler';
import { downloadopenmpServer, downloadSampServer } from './serverDownload';
import { cleanupGamemodeFiles, cleanupFiles, createSpinner } from './utils';

export async function setupInitCommand(options: CommandOptions): Promise<void> {
  const pawnJsonPath = path.join(process.cwd(), '.pawnctl', 'pawn.json');
  if (fs.existsSync(pawnJsonPath)) {
    logger.warn(
      'A project already exists in this folder (pawn.json detected). Initialization aborted.'
    );
    return;
  }

  // Detect existing Pawn project files if no pawn.json
  const hasPawnFiles =
    ['gamemodes', 'filterscripts', 'includes', 'plugins', 'scriptfiles'].some(
      (dir) => fs.existsSync(path.join(process.cwd(), dir))
    ) ||
    fs
      .readdirSync(process.cwd())
      .some((file) => file.endsWith('.pwn') || file.endsWith('.inc'));

  let detectedName: string | undefined;
  let detectedInitGit = false;
  const _detectedProjectType: 'gamemode' | 'filterscript' | 'library' =
    'gamemode';

  if (hasPawnFiles) {
    const convert = await confirm({
      message:
        'This folder contains Pawn project files but no pawn.json manifest. Convert this project to use pawnctl?',
      default: true,
    });
    if (!convert) {
      logger.warn('Initialization aborted by user.');
      return;
    }
    logger.info('Converting existing project to pawnctl...');
    // Detect main .pwn file in gamemodes, filterscripts, or root
    const gmDir = path.join(process.cwd(), 'gamemodes');
    const fsDir = path.join(process.cwd(), 'filterscripts');
    let mainPwn: string | undefined;
    if (fs.existsSync(gmDir)) {
      const files = fs.readdirSync(gmDir).filter((f) => f.endsWith('.pwn'));
      if (files.length > 0) {
        mainPwn = files[0];
        // detectedProjectType = 'gamemode';
      }
    }
    if (!mainPwn && fs.existsSync(fsDir)) {
      const files = fs.readdirSync(fsDir).filter((f) => f.endsWith('.pwn'));
      if (files.length > 0) {
        mainPwn = files[0];
        // detectedProjectType = 'filterscript';
      }
    }
    if (!mainPwn) {
      // Try root
      const files = fs
        .readdirSync(process.cwd())
        .filter((f) => f.endsWith('.pwn'));
      if (files.length > 0) {
        mainPwn = files[0];
        // detectedProjectType = 'gamemode';
      }
    }
    if (mainPwn) {
      detectedName = path.basename(mainPwn, '.pwn');
    }
    // Detect .git
    detectedInitGit = fs.existsSync(path.join(process.cwd(), '.git'));
  }

  try {
    const isLegacySamp = options.legacySamp;
    logger.heading(`Initializing new ${isLegacySamp ? 'SA-MP' : 'open.mp'} project...`);

    const initialAnswers = await promptForInitialOptions({
      ...options,
      name: detectedName || options.name,
      initGit: detectedInitGit,
    });
    logger.newline();
    logger.subheading('Setting up your project...');

    await setupProjectStructure(initialAnswers, isLegacySamp);

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
        if (isLegacySamp) {
          await downloadSampServer('latest', directories);
        } else {
          await downloadopenmpServer('latest', directories);
        }
      } catch {
        // Error handling inside downloadopenmpServer
      }
    }

    // Get compiler options while server is downloading
    let compilerAnswers: CompilerAnswers;

    if (options.skipCompiler) {
      logger.info('Skipping compiler setup. Using default settings.');
      compilerAnswers = {
        downloadCompiler: false,
        compilerVersion: 'latest',
        keepQawno: true,
        downgradeQawno: false,
        installCompilerFolder: false,
        useCompilerFolder: false,
        downloadStdLib: true,
      };
    } else {
      compilerAnswers = await promptForCompilerOptions(isLegacySamp).catch((error) => {
        if (error.message === 'User force closed the prompt with 0') {
          logger.warn(
            'Compiler setup was interrupted. Using default settings.'
          );
          return {
            downloadCompiler: false,
            compilerVersion: 'latest',
            keepQawno: true,
            downgradeQawno: false,
            installCompilerFolder: false,
            useCompilerFolder: false,
            downloadStdLib: true,
          };
        }
        throw error;
      });
    }
    await setupCompiler(compilerAnswers);
    await updateServerConfiguration(initialAnswers.name, isLegacySamp);

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
              cleanupSpinner.warn(
                `Could not remove extract directory after ${maxRetries} attempts`
              );
              logger.warn(
                'You may need to manually delete the temp_extract directory later'
              );
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
    logger.error(
      `Failed to initialize project: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exit(1);
  }
}

async function updateServerConfiguration(projectName: string, isLegacySamp: boolean = false): Promise<void> {
  const configSpinner = createSpinner('Updating server configuration...');
  try {
    if (isLegacySamp) {
      // Handle SA-MP server.cfg
      const configPath = path.join(process.cwd(), 'server.cfg');
      if (fs.existsSync(configPath)) {
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        // Update gamemode line
        configContent = configContent.replace(
          /^gamemode\s+.*$/m,
          `gamemode ${projectName} 1`
        );
        
        // Update server name if it's the default
        configContent = configContent.replace(
          /^hostname\s+.*$/m,
          `hostname ${projectName} | SA-MP Server`
        );
        
        fs.writeFileSync(configPath, configContent);
        configSpinner.succeed('Server configuration updated');
      } else {
        configSpinner.info('No server.cfg found');
      }
    } else {
      // Handle open.mp config.json
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
    }
  } catch (error) {
    configSpinner.fail(
      `Could not update server configuration: ${error instanceof Error ? error.message : 'unknown error'}`
    );
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
      ...(answers.editor === 'VS Code'
        ? [
            'Press Ctrl+Shift+B in VS Code to run the build task',
            'Press F5 to start the server',
          ]
        : []),
      ...(answers.initGit
        ? [
            `Use ${answers.editor === 'VS Code' ? "VS Code's built-in Git tools" : 'Git commands'} to push to GitHub or another Git provider`,
          ]
        : []),
    ]);
  }
}

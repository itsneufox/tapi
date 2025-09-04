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

interface ExistingProject {
  type: string;
  path: string;
  format: 'pawnctl' | 'sampctl' | 'other';
}

function detectExistingProject(): ExistingProject | null {
  const currentDir = process.cwd();
  
  // Check for pawnctl project
  const pawnctlPath = path.join(currentDir, '.pawnctl', 'pawn.json');
  if (fs.existsSync(pawnctlPath)) {
    return {
      type: 'pawnctl project (pawn.json)',
      path: pawnctlPath,
      format: 'pawnctl'
    };
  }
  
  // Check for sampctl project (root pawn.json)
  const sampctlPath = path.join(currentDir, 'pawn.json');
  if (fs.existsSync(sampctlPath)) {
    return {
      type: 'sampctl project (pawn.json)',
      path: sampctlPath,
      format: 'sampctl'
    };
  }
  
  // No other project files to check - only detect actual Pawn project formats
  
  return null;
}

export async function setupInitCommand(options: CommandOptions): Promise<void> {
  // Check for existing project formats
  const existingProject = detectExistingProject();
  if (existingProject) {
    logger.warn(
      `A project already exists in this folder (${existingProject.type} detected). Initialization aborted.`
    );
    return;
  }

  // Check if directory is empty or contains only safe files
  const currentDir = process.cwd();
  const dirContents = fs.readdirSync(currentDir);
  
  // Filter out safe files/directories that won't conflict with pawnctl init
  const safeFiles = [
    // Basic development files that don't conflict
    '.git', '.gitignore', '.gitattributes', 
    'README.md', 'LICENSE', '.editorconfig',
    '.vscode', '.idea',
    
    // Server executables (don't conflict with project structure)
    'samp-server.exe', 'samp-npc.exe', 'announce.exe',
    'omp-server.exe', 'omp-server.pdb',
    
    // Server configuration files that might exist from server downloads
    'server.cfg', 'config.json', 'bans.json',
    'samp-license.txt', 'server-readme.txt',
    
    // Server components and tools directories (read-only, don't conflict)
    'components', 'models', 'qawno', 'pawno', 'npcmodes',
    
    // Log files and temporary directories
    'logs', 'crashinfo', 'temp_extract',
    'server_log.txt', 'chatlog.txt', 'mysql_log.txt',
    
    // pawnctl's own directory
    '.pawnctl'
  ];
  
  const nonSafeFiles = dirContents.filter(item => {
    // Skip safe files/directories
    if (safeFiles.includes(item)) return false;
    
    // Skip hidden files (except .git)
    if (item.startsWith('.') && item !== '.git') return false;
    
    return true;
  });

  // If there are non-safe files, warn the user
  if (nonSafeFiles.length > 0) {
    logger.warn('⚠️  This directory is not empty and contains files that may conflict with project initialization.');
    logger.warn(`   Found: ${nonSafeFiles.slice(0, 5).join(', ')}${nonSafeFiles.length > 5 ? ` and ${nonSafeFiles.length - 5} more` : ''}`);
    
    const proceed = await confirm({
      message: 'Do you want to proceed with initialization? This may overwrite existing files.',
      default: false,
    });
    
    if (!proceed) {
      logger.warn('Initialization aborted by user.');
      return;
    }
    
    logger.info('Proceeding with initialization. Existing files may be affected.');
  }

  // Detect existing Pawn project files or sampctl project for conversion
  const sampctlProject = fs.existsSync(path.join(process.cwd(), 'pawn.json'));
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

  if (hasPawnFiles || sampctlProject) {
    const projectType = sampctlProject ? 'sampctl project' : 'Pawn project files';
    const message = sampctlProject 
      ? 'This folder contains a sampctl project (pawn.json). Convert to pawnctl format?'
      : 'This folder contains Pawn project files but no pawn.json manifest. Convert this project to use pawnctl?';
      
    const convert = await confirm({
      message,
      default: true,
    });
    if (!convert) {
      logger.warn('Initialization aborted by user.');
      return;
    }
    logger.info(`Converting existing ${projectType} to pawnctl...`);
    
    // If sampctl project, try to extract information from pawn.json
    if (sampctlProject) {
      try {
        const sampctlConfigPath = path.join(process.cwd(), 'pawn.json');
        const sampctlConfig = JSON.parse(fs.readFileSync(sampctlConfigPath, 'utf8'));
        
        // Extract project name with priority: repo > entry > runtime.gamemodes[0]
        if (sampctlConfig.repo) {
          detectedName = sampctlConfig.repo;
        } else if (sampctlConfig.entry) {
          detectedName = path.basename(sampctlConfig.entry, '.pwn');
        } else if (sampctlConfig.runtime?.gamemodes?.[0]) {
          detectedName = sampctlConfig.runtime.gamemodes[0];
        } else if (sampctlConfig.build?.input) {
          detectedName = path.basename(sampctlConfig.build.input, '.pwn');
        }
        
        // Log detected information in verbose mode
        if (logger.getVerbosity() === 'verbose') {
          logger.detail(`Detected sampctl project: ${detectedName || 'unknown'}`);
          if (sampctlConfig.dependencies?.length > 0) {
            logger.detail(`Found ${sampctlConfig.dependencies.length} dependencies`);
          }
          if (sampctlConfig.runtime) {
            logger.detail('Found runtime configuration');
          }
          if (sampctlConfig.build || sampctlConfig.builds) {
            logger.detail('Found build configuration');
          }
        }
      } catch (error) {
        logger.warn(`Could not parse sampctl pawn.json: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    
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

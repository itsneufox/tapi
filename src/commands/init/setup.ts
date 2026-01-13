import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { configManager } from '../../utils/config';
import { CommandOptions, InitialAnswers, CompilerAnswers } from './types';
import { promptForInitialOptions, promptForCompilerOptions } from './prompts';
import { confirm, select, checkbox } from '@inquirer/prompts';
import { setupProjectStructure } from './projectStructure';
import { setupCompiler, hasExistingStandardLibrary } from './compiler';
import {
  downloadopenmpServer,
  downloadSampServer,
  ServerInstallationSummary,
} from './serverDownload';
import { cleanupGamemodeFiles, cleanupFiles, createSpinner } from './utils';
import { loadInitPreset } from '../../utils/preset';
import { showBanner } from '../../utils/banner';

interface ConflictResolution {
  proceed: boolean;
  createBackup?: boolean;
  selectedFiles?: string[];
}

/**
 * Categorize potentially conflicting files in the target directory prior to init.
 */
async function analyzeConflictingFiles(files: string[]): Promise<{ 
  potentially_user_content: string[], 
  probably_safe: string[], 
  might_overwrite: string[] 
}> {
  const potentially_user_content: string[] = [];
  const probably_safe: string[] = [];
  const might_overwrite: string[] = [];

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Check if directory contains user content
      if (['gamemodes', 'filterscripts', 'includes'].includes(file)) {
        const dirContents = fs.readdirSync(filePath);
        if (dirContents.some(f => f.endsWith('.pwn') || f.endsWith('.inc'))) {
          potentially_user_content.push(file);
        } else {
          might_overwrite.push(file);
        }
      } else {
        probably_safe.push(file);
      }
    } else {
      // Check file extensions and names
      if (file.endsWith('.pwn') || file.endsWith('.inc') || file.endsWith('.amx')) {
        potentially_user_content.push(file);
      } else if (['pawn.json', 'server.cfg', 'config.json'].includes(file)) {
        might_overwrite.push(file);
      } else {
        probably_safe.push(file);
      }
    }
  }

  return { potentially_user_content, probably_safe, might_overwrite };
}

/**
 * Guide the user through resolving conflicts when initializing into a non-empty directory.
 */
async function handleConflictResolution(conflictingFiles: string[]): Promise<ConflictResolution> {
  logger.warn('Directory Analysis: Found files that may conflict with project initialization.');
  
  const analysis = await analyzeConflictingFiles(conflictingFiles);
  
  // Show detailed analysis
  if (analysis.potentially_user_content.length > 0) {
    logger.error(`User Content Detected (${analysis.potentially_user_content.length} items):`);
    analysis.potentially_user_content.forEach(file => {
      logger.error(`   ${file}`);
    });
  }
  
  if (analysis.might_overwrite.length > 0) {
    logger.warn(`May Be Overwritten (${analysis.might_overwrite.length} items):`);
    analysis.might_overwrite.forEach(file => {
      logger.warn(`   ${file}`);
    });
  }
  
  if (analysis.probably_safe.length > 0) {
    logger.info(`Probably Safe (${analysis.probably_safe.length} items):`);
    analysis.probably_safe.slice(0, 3).forEach(file => {
      logger.info(`   ${file}`);
    });
    if (analysis.probably_safe.length > 3) {
      logger.info(`   ... and ${analysis.probably_safe.length - 3} more`);
    }
  }

  // If there's user content, strongly recommend against proceeding
  if (analysis.potentially_user_content.length > 0) {
    logger.newline();
    logger.error('WARNING: This appears to be an existing project with user code!');
    logger.error('   Proceeding may overwrite your work.');
    logger.newline();
  }

  const action = await select({
    message: 'How would you like to proceed?',
    choices: [
      {
        name: 'Abort - Cancel initialization (Recommended if user content detected)',
        value: 'abort',
        description: 'Exit without making any changes'
      },
      {
        name: 'Create backup and proceed',
        value: 'backup',
        description: 'Create timestamped backup of conflicting files before proceeding'
      },
      {
        name: 'Selective overwrite',
        value: 'selective',
        description: 'Choose which files to keep/overwrite'
      },
      {
        name: 'Force proceed (dangerous)',
        value: 'force',
        description: 'Proceed without backup - may overwrite existing files'
      }
    ],
    default: analysis.potentially_user_content.length > 0 ? 'abort' : 'backup'
  });

  switch (action) {
    case 'abort':
      return { proceed: false };
      
    case 'backup':
      await createBackup(conflictingFiles);
      logger.success('Backup created. Proceeding with initialization...');
      return { proceed: true, createBackup: true };
      
    case 'selective': {
      const selectedFiles = await selectFilesToOverwrite(conflictingFiles, analysis);
      if (selectedFiles.length === 0) {
        logger.info('No files selected for overwrite. Aborting initialization.');
        return { proceed: false };
      }
      return { proceed: true, selectedFiles };
    }
      
    case 'force': {
      const confirmForce = await confirm({
        message: 'Are you absolutely sure? This may overwrite existing files without backup.',
        default: false
      });
      if (!confirmForce) {
        return { proceed: false };
      }
      logger.warn('Force proceeding without backup...');
      return { proceed: true };
    }
      
    default:
      return { proceed: false };
  }
}

/**
 * Create a timestamped backup folder containing the provided file list.
 */
async function createBackup(files: string[]): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(process.cwd(), `.tapi-backup-${timestamp}`);
  
  logger.info(`Creating backup in: ${path.basename(backupDir)}`);
  fs.mkdirSync(backupDir, { recursive: true });
  
  for (const file of files) {
    const sourcePath = path.join(process.cwd(), file);
    const backupPath = path.join(backupDir, file);
    
    try {
      if (fs.statSync(sourcePath).isDirectory()) {
        // Copy directory recursively
        fs.cpSync(sourcePath, backupPath, { recursive: true });
      } else {
        // Copy file
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(sourcePath, backupPath);
      }
      logger.detail(`Backed up: ${file}`);
    } catch (error) {
      logger.warn(`Failed to backup ${file}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

/**
 * Present a checkbox prompt allowing the user to select which files can be overwritten.
 */
async function selectFilesToOverwrite(files: string[], analysis: { 
  potentially_user_content: string[], 
  probably_safe: string[], 
  might_overwrite: string[] 
}): Promise<string[]> {
  logger.info('Select files/directories that tapi is allowed to overwrite:');
  logger.warn('Files marked with [!] contain user content - be careful!');
  
  const choices = files.map(file => {
    let prefix = '';
    let description = 'Probably safe to overwrite';
    
    if (analysis.potentially_user_content.includes(file)) {
      prefix = '[!] ';
      description = 'Contains user content - be careful!';
    } else if (analysis.might_overwrite.includes(file)) {
      prefix = '[?] ';
      description = 'May be overwritten';
    } else {
      prefix = '[OK] ';
    }
    
    return {
      name: `${prefix}${file}`,
      value: file,
      description,
      checked: analysis.probably_safe.includes(file) // Only safe files checked by default
    };
  });

  return await checkbox({
    message: 'Select files to allow overwriting:',
    choices,
    required: false
  });
}

interface ExistingProject {
  type: string;
  path: string;
  format: 'tapi' | 'sampctl' | 'other';
}

/**
 * Inspect the directory to see if it already contains a bare server package.
 */
function detectBareServerPackage(): { type: 'openmp' | 'samp' | null, hasContent: boolean } {
  const currentDir = process.cwd();
  
  // Check for open.mp server package
  const ompServer = fs.existsSync(path.join(currentDir, 'omp-server.exe'));
  const ompComponents = fs.existsSync(path.join(currentDir, 'components'));
  
  // Check for SA-MP server package  
  const sampServer = fs.existsSync(path.join(currentDir, 'samp-server.exe'));
  const sampPlugins = fs.existsSync(path.join(currentDir, 'plugins'));
  
  // Check if there's existing content (not just empty server package)
  const gamemodesDir = path.join(currentDir, 'gamemodes');
  const hasGamemodes = fs.existsSync(gamemodesDir) && 
    fs.readdirSync(gamemodesDir).some(f => f.endsWith('.amx') || f.endsWith('.pwn'));
  
  const filterscriptsDir = path.join(currentDir, 'filterscripts');
  const hasFilterscripts = fs.existsSync(filterscriptsDir) && 
    fs.readdirSync(filterscriptsDir).some(f => f.endsWith('.amx') || f.endsWith('.pwn'));
    
  const hasContent = hasGamemodes || hasFilterscripts;
  
  if (ompServer && ompComponents) {
    return { type: 'openmp', hasContent };
  } else if (sampServer && sampPlugins) {
    return { type: 'samp', hasContent };
  }
  
  return { type: null, hasContent };
}

/**
 * Check for existing project structures that would conflict with init.
 */
function detectExistingProject(): ExistingProject | null {
  const currentDir = process.cwd();
  
  // Check for tapi project
  const tapiPath = path.join(currentDir, '.tapi', 'pawn.json');
  if (fs.existsSync(tapiPath)) {
    return {
      type: 'tapi project (pawn.json)',
      path: tapiPath,
      format: 'tapi'
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

/**
 * Execute the full initialization workflow: prompts, validation, downloads, and file generation.
 */
export async function setupInitCommand(rawOptions: CommandOptions): Promise<void> {
  const options: CommandOptions = { ...rawOptions };

  if (options.quiet) {
    logger.setVerbosity('quiet');
  } else if (options.verbose) {
    logger.setVerbosity('verbose');
  }

  let loadedPreset: ReturnType<typeof loadInitPreset> | null = null;
  try {
    loadedPreset = loadInitPreset(options.preset);
  } catch (error) {
    logger.error(
      `Failed to load init preset: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exit(1);
  }

  if (loadedPreset?.options?.legacySamp !== undefined && options.legacySamp === undefined) {
    options.legacySamp = loadedPreset.options.legacySamp;
  }

  if (loadedPreset?.options?.skipCompiler !== undefined && options.skipCompiler === undefined) {
    options.skipCompiler = loadedPreset.options.skipCompiler;
  }

  if (loadedPreset?.options?.quiet && !options.quiet) {
    options.quiet = true;
    logger.setVerbosity('quiet');
  } else if (
    !options.quiet &&
    (options.verbose || loadedPreset?.options?.verbose) &&
    loadedPreset?.options?.quiet !== true
  ) {
    options.verbose = true;
    logger.setVerbosity('verbose');
  }

  const projectDefaults: Partial<InitialAnswers> = {
    ...(loadedPreset?.project ?? {}),
  };
  const compilerDefaults: Partial<CompilerAnswers> = {
    ...(loadedPreset?.compiler ?? {}),
  };

  if (!options.name && projectDefaults.name) {
    options.name = projectDefaults.name;
  }
  if (!options.description && projectDefaults.description) {
    options.description = projectDefaults.description;
  }
  if (!options.author && projectDefaults.author) {
    options.author = projectDefaults.author;
  }

  const usePresetNonInteractive = Boolean(
    options.acceptPreset || options.nonInteractive || loadedPreset?.acceptPreset
  );

  showBanner(logger.getVerbosity() !== 'quiet');

  const verbosity = logger.getVerbosity();
  const isQuiet = verbosity === 'quiet';
  const isVerbose = verbosity === 'verbose';

  const shareDetail = (message: string) => {
    if (isVerbose) {
      logger.detail(message);
    }
  };

  if (loadedPreset?.source) {
    shareDetail(`Loaded init preset from ${loadedPreset.source}`);
  }
  if (usePresetNonInteractive) {
    shareDetail('Running init in non-interactive mode');
  }

  // Check for existing project formats
  const existingProject = detectExistingProject();
  if (existingProject) {
    logger.warn(
      `A project already exists in this folder (${existingProject.type} detected). Initialization aborted.`
    );
    return;
  }

  // Check if this is a bare server package
  const serverPackage = detectBareServerPackage();
  if (serverPackage.type && !serverPackage.hasContent) {
    logger.info(`Detected bare ${serverPackage.type.toUpperCase()} server package - setting up project...`);
    // Skip the "directory not empty" warnings for bare server packages
  }

  // Check if directory is empty or contains only safe files
  const currentDir = process.cwd();
  const dirContents = fs.readdirSync(currentDir);
  
  // Filter out safe files/directories that won't conflict with tapi init
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
    
    // tapi's own directory
    '.tapi'
  ];
  
  const nonSafeFiles = dirContents.filter(item => {
    // Skip safe files/directories
    if (safeFiles.includes(item)) return false;
    
    // Skip hidden files (except .git)
    if (item.startsWith('.') && item !== '.git') return false;
    
    return true;
  });

  // If there are non-safe files, provide detailed conflict resolution (unless it's a bare server package)
  if (nonSafeFiles.length > 0 && !(serverPackage.type && !serverPackage.hasContent)) {
    if (usePresetNonInteractive) {
      logger.error(
        'Conflicting files detected while running with --non-interactive/--accept-preset.'
      );
      logger.error('Initialization aborted to avoid prompting for manual input.');
      return;
    }
    const conflictResolution = await handleConflictResolution(nonSafeFiles);
    if (!conflictResolution.proceed) {
      logger.warn('Initialization aborted by user.');
      return;
    }
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
  const _detectedProjectType: 'gamemode' | 'filterscript' | 'library' = 'gamemode';

  // Suggest project name based on server package type if no other name detected
  if (serverPackage.type && !detectedName) {
    const dirName = path.basename(process.cwd());
    if (dirName && dirName !== '.' && dirName !== 'Server') {
      detectedName = dirName;
    } else {
      detectedName = serverPackage.type === 'openmp' ? 'my-openmp-project' : 'my-samp-project';
    }
  }

  if (hasPawnFiles || sampctlProject) {
    const projectType = sampctlProject ? 'sampctl project' : 'Pawn project files';
    const message = sampctlProject 
      ? 'This folder contains a sampctl project (pawn.json). Convert to tapi format?'
      : 'This folder contains Pawn project files but no pawn.json manifest. Convert this project to use tapi?';
      
    const convert = await confirm({
      message,
      default: true,
    });
    if (!convert) {
      logger.warn('Initialization aborted by user.');
      return;
    }
    logger.info(`Converting existing ${projectType} to tapi...`);
    
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
    const gitExists = fs.existsSync(path.join(process.cwd(), '.git'));
    if (gitExists && projectDefaults.initGit === undefined) {
      projectDefaults.initGit = false;
    }
  }

  const announceStep = (step: number, label: string) => {
    if (isQuiet) return;
    logger.working(`Step ${step}/5: ${label}`);
  };

  const completeStep = (message: string) => {
    if (isQuiet) return;
    logger.success(message);
  };

  try {
    // Auto-detect server type from package, or use command line option
    const isLegacySamp = serverPackage.type === 'samp' ? true : 
                        serverPackage.type === 'openmp' ? false : 
                        options.legacySamp;
    
    const serverTypeText = isLegacySamp ? 'SA-MP' : 'open.mp';
    if (serverPackage.type) {
      logger.heading(`Setting up ${serverTypeText} project in detected server package...`);
    } else {
      logger.heading(`Initializing new ${serverTypeText} project...`);
    }

    if (!isQuiet) {
      logger.info('Starting initialization (5 steps)...');
      if (isVerbose) {
        logger.detail('Steps: configuration → project files → compiler → server config → cleanup');
      }
    }

    // Step 1: Project Configuration
    announceStep(1, 'Project configuration');
    const promptOptions: CommandOptions = { ...options };
    if (detectedName && !promptOptions.name) {
      promptOptions.name = detectedName;
    }
    const initialAnswers = await promptForInitialOptions(
      promptOptions,
      projectDefaults,
      usePresetNonInteractive
    );
    completeStep('Configuration saved');

  // Step 2: Directory Structure Setup
    announceStep(2, 'Preparing project files');
    await setupProjectStructure(initialAnswers, isLegacySamp);
    let serverInstallSummary: ServerInstallationSummary | undefined;

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
        serverInstallSummary = isLegacySamp
          ? await downloadSampServer('latest', directories)
          : await downloadopenmpServer('latest', directories);
      } catch {
        // Error handling inside downloadopenmpServer
      }
    }

    const projectFilesMessage = (() => {
      if (!initialAnswers.downloadServer) {
        return 'Project files ready';
      }
      if (serverInstallSummary?.executable) {
        return `Project files ready (server: ${serverInstallSummary.executable})`;
      }
      return 'Project files ready (server download skipped)';
    })();
    completeStep(projectFilesMessage);

    // Step 3: Compiler Configuration
    announceStep(3, 'Configuring compiler tools');
    let compilerAnswers: CompilerAnswers;

    if (options.skipCompiler) {
      shareDetail('Skipping compiler setup (--skip-compiler)');
      const stdLibPresent = hasExistingStandardLibrary();
      compilerAnswers = {
        downloadCompiler: false,
        compilerVersion: compilerDefaults.compilerVersion ?? 'latest',
        keepQawno: compilerDefaults.keepQawno ?? true,
        downgradeQawno: compilerDefaults.downgradeQawno ?? false,
        installCompilerFolder: compilerDefaults.installCompilerFolder ?? false,
        useCompilerFolder: compilerDefaults.useCompilerFolder ?? false,
        downloadStdLib:
          compilerDefaults.downloadStdLib ?? !stdLibPresent,
      };
    } else {
      compilerAnswers = await promptForCompilerOptions(
        isLegacySamp,
        compilerDefaults,
        usePresetNonInteractive
      ).catch((error) => {
        if (error instanceof Error && error.message === 'User force closed the prompt with 0') {
          logger.warn(
            'Compiler setup was interrupted. Using default settings.'
          );
          const stdLibPresent = hasExistingStandardLibrary();
          return {
            downloadCompiler: compilerDefaults.downloadCompiler ?? false,
            compilerVersion: compilerDefaults.compilerVersion ?? 'latest',
            keepQawno: compilerDefaults.keepQawno ?? true,
            downgradeQawno: compilerDefaults.downgradeQawno ?? false,
            installCompilerFolder: compilerDefaults.installCompilerFolder ?? false,
            useCompilerFolder: compilerDefaults.useCompilerFolder ?? false,
            downloadStdLib:
              compilerDefaults.downloadStdLib ?? !stdLibPresent,
          };
        }
        throw error;
      });
    }
    await setupCompiler(compilerAnswers);
    completeStep('Compiler tools configured');
    
    // Step 4: Server Configuration
    announceStep(4, 'Updating server configuration');
    await updateServerConfiguration(initialAnswers.name, isLegacySamp);
    completeStep('Server configuration updated');

    const answers = {
      ...initialAnswers,
      ...compilerAnswers,
    };

    // Step 5: Final Setup and Cleanup
    announceStep(5, 'Final cleanup');
    
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

/**
 * Update server configuration files with the newly created project defaults.
 */
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

/**
 * Display a friendly summary of next steps after initialization completes.
 */
function showSuccessInfo(answers: InitialAnswers & CompilerAnswers): void {
  logger.finalSuccess('Project initialization complete!');

  const verbosity = logger.getVerbosity();
  if (verbosity === 'quiet') {
    return;
  }

  const projectFile = `${answers.projectType === 'gamemode' ? 'gamemodes/' : answers.projectType === 'filterscript' ? 'filterscripts/' : 'includes/'}${answers.name}.${answers.projectType === 'library' ? 'inc' : 'pwn'}`;

  if (verbosity === 'verbose') {
    logger.newline();
    logger.subheading('Project Structure Created:');
    logger.list([
      `${projectFile} - Your main ${answers.projectType} file`,
      'gamemodes/ - Server gamemodes directory',
      'filterscripts/ - Server filterscripts directory',
      'includes/ - Custom include files',
      'plugins/ - Server plugins directory',
      'scriptfiles/ - Server data files',
      ...(answers.editor === 'VS Code' ? ['.vscode/ - VS Code configuration'] : []),
      ...(answers.initGit ? ['.git/ - Git repository initialized'] : []),
    ]);

    logger.newline();
    logger.subheading('Quick Start Commands:');
    logger.list([
      `Edit: Open ${projectFile} in your editor`,
      'Build: tapi build',
      'Start Server: tapi start',
      'Stop Server: tapi stop',
      ...(answers.editor === 'VS Code'
        ? [
            'VS Code Build: Ctrl+Shift+B',
            'VS Code Debug: F5',
          ]
        : []),
    ]);

    if (answers.initGit) {
      logger.newline();
      logger.subheading('Git Repository:');
      logger.list([
        'git add . && git commit -m "Initial project setup"',
        'git remote add origin <your-repo-url>',
        'git push -u origin main',
      ]);
    }

    logger.newline();
    logger.hint('Need help? Run "tapi --help" for available commands');
    logger.hint('Documentation: https://github.com/your-org/tapi');
    return;
  }

  logger.newline();
  logger.hint(`Edit your main script: ${projectFile}`);
  logger.hint('Build: tapi build');
  logger.hint('Start server: tapi start');
  if (answers.editor === 'VS Code') {
    logger.hint('VS Code build task: Ctrl+Shift+B');
  }
  logger.hint('Need help? Run "tapi --help" or visit the docs.');
}

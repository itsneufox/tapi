import * as fs from 'fs';
import * as path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { getLatestCompilerVersion, hasExistingStandardLibrary } from './compiler';
import { CommandOptions, InitialAnswers, CompilerAnswers } from './types';

/**
 * Prompt for base project metadata when running `tapi init`.
 */
export async function promptForInitialOptions(
  options: CommandOptions,
  defaults: Partial<InitialAnswers> = {},
  nonInteractive = false
): Promise<InitialAnswers> {
  const isLegacySamp = options.legacySamp;
  const folderName = path.basename(process.cwd());
  const configDefaultAuthor = configManager.getDefaultAuthor();

  const resolvedName = defaults.name ?? options.name ?? folderName;
  const resolvedDescription = defaults.description ?? options.description ?? '';
  const resolvedAuthor =
    defaults.author ?? options.author ?? configDefaultAuthor ?? '';
  const resolvedProjectType = (defaults.projectType ?? 'gamemode') as
    | 'gamemode'
    | 'filterscript'
    | 'library';
  const resolvedEditor = (
    defaults.editor ?? configManager.getEditor() ?? 'VS Code'
  ) as 'VS Code' | 'Sublime Text' | 'Other/None';
  const resolvedInitGit = defaults.initGit ?? true;
  const resolvedDownloadServer = defaults.downloadServer ?? true;
  const resolvedAddStdLib = defaults.addStdLib ?? true;

  if (nonInteractive) {
    return {
      name: resolvedName,
      description: resolvedDescription,
      author: resolvedAuthor,
      projectType: resolvedProjectType,
      addStdLib: resolvedAddStdLib,
      initGit: resolvedInitGit,
      downloadServer: resolvedDownloadServer,
      editor: resolvedEditor,
    };
  }

  const name =
    options.name ??
    defaults.name ??
    (await input({
      message: 'Project name:',
      default: resolvedName,
    }));

  const description =
    options.description ??
    defaults.description ??
    (await input({
      message: 'Project description:',
      default: resolvedDescription,
    }));

  const author =
    options.author ??
    defaults.author ??
    (await input({
      message: 'Author:',
      default: resolvedAuthor,
    }));

  const projectType = (await select({
    message: 'Project type:',
    choices: [
      { value: 'gamemode', name: 'gamemode' },
      { value: 'filterscript', name: 'filterscript' },
      { value: 'library', name: 'library' },
    ],
    default: resolvedProjectType,
  })) as 'gamemode' | 'filterscript' | 'library';

  const editor = (await select({
    message: 'Which editor are you using?',
    choices: [
      { value: 'VS Code', name: 'VS Code' },
      { value: 'Sublime Text', name: 'Sublime Text' },
      { value: 'Other/None', name: 'Other/None' },
    ],
    default: resolvedEditor,
  })) as 'VS Code' | 'Sublime Text' | 'Other/None';

  const initGit = await confirm({
    message: 'Initialize Git repository?',
    default: resolvedInitGit,
  });
  const downloadServer = await confirm({
    message: `Add ${isLegacySamp ? 'SA-MP' : 'open.mp'} server package?`,
    default: resolvedDownloadServer,
  });
  return {
    name,
    description,
    author,
    projectType,
    addStdLib: resolvedAddStdLib,
    initGit,
    downloadServer,
    editor,
  };
}

/**
 * Collect compiler installation preferences, handling existing installs and version conflicts.
 */
export async function promptForCompilerOptions(
  isLegacySamp: boolean = false,
  defaults: Partial<CompilerAnswers> = {},
  nonInteractive = false
): Promise<CompilerAnswers> {
  const hasExistingCompiler =
    fs.existsSync(path.join(process.cwd(), 'pawno', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'pawno', 'pawncc')) ||
    fs.existsSync(path.join(process.cwd(), 'qawno', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'qawno', 'pawncc')) ||
    fs.existsSync(path.join(process.cwd(), 'compiler', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'compiler', 'pawncc'));
  const stdLibAlreadyPresent = hasExistingStandardLibrary();

  const defaultDownloadCompiler = () => (hasExistingCompiler ? false : true);

  if (nonInteractive) {
    const downloadCompiler =
      defaults.downloadCompiler ?? defaultDownloadCompiler();
    return {
      downloadCompiler,
      compilerVersion: defaults.compilerVersion ?? 'latest',
      keepQawno: defaults.keepQawno ?? true,
      downgradeQawno: defaults.downgradeQawno ?? false,
      installCompilerFolder: defaults.installCompilerFolder ?? false,
      useCompilerFolder: defaults.useCompilerFolder ?? false,
      downloadStdLib:
        defaults.downloadStdLib ?? !stdLibAlreadyPresent,
      compilerDownloadUrl: defaults.compilerDownloadUrl,
      stdLibDownloadUrl: defaults.stdLibDownloadUrl,
    };
  }

  let downloadCompiler: boolean;
  if (defaults.downloadCompiler !== undefined) {
    downloadCompiler = defaults.downloadCompiler;
  } else if (hasExistingCompiler) {
    downloadCompiler = await confirm({
      message: 'Download community pawn compiler? (A compiler already exists)',
      default: false,
    });
  } else {
    downloadCompiler = true;
  }

  let compilerVersion = defaults.compilerVersion ?? 'latest';
  let keepQawno = defaults.keepQawno ?? true;
  let installCompilerFolder = defaults.installCompilerFolder ?? false;
  let useCompilerFolder = defaults.useCompilerFolder ?? false;
  let downloadStdLib = defaults.downloadStdLib ?? !stdLibAlreadyPresent;
  let downgradeQawno = defaults.downgradeQawno ?? false;
  const compilerDownloadUrl = defaults.compilerDownloadUrl;
  const stdLibDownloadUrl = defaults.stdLibDownloadUrl;

  if (!downloadCompiler) {
    if (defaults.downloadStdLib === undefined) {
      if (!stdLibAlreadyPresent) {
        downloadStdLib = await confirm({
          message: `Download ${isLegacySamp ? 'SA-MP' : 'open.mp'} standard library?`,
          default: true,
        });
      } else if (logger.getVerbosity() !== 'quiet') {
        logger.hint(
          'Standard library detected. Skipping download — remove existing includes if you need a fresh copy.'
        );
        downloadStdLib = false;
      }
    } else if (stdLibAlreadyPresent && defaults.downloadStdLib && logger.getVerbosity() === 'verbose') {
      logger.detail('Preset requests standard library download despite existing files');
    }
    return {
      downloadCompiler,
      compilerVersion,
      keepQawno,
      downgradeQawno,
      installCompilerFolder,
      useCompilerFolder,
      downloadStdLib,
    };
  }

  if (defaults.compilerVersion === undefined) {
    compilerVersion = await input({
      message: 'Enter the compiler version (or "latest" for the latest version):',
      default: compilerVersion,
    });
  }

  const qawnoDir = path.join(process.cwd(), 'qawno');
  const hasQawno = fs.existsSync(qawnoDir);
  let existingVersion: string | null = null;
  let cleanTargetVersion = compilerVersion;
  if (compilerVersion === 'latest') {
    cleanTargetVersion = await getLatestCompilerVersion();
  }
  if (cleanTargetVersion.startsWith('v')) {
    cleanTargetVersion = cleanTargetVersion.substring(1);
  }

  if (hasQawno) {
    existingVersion = await checkExistingCompilerVersion(qawnoDir);
  }

  if (
    hasQawno &&
    existingVersion &&
    defaults.keepQawno === undefined
  ) {
    const comparison = compareVersions(cleanTargetVersion, existingVersion);
    const isDowngrade = comparison < 0;

    if (isDowngrade) {
      logger.warn(`Version conflict detected!`);
      logger.warn(`   Server package includes: ${existingVersion}`);
      logger.warn(`   Community compiler version: ${cleanTargetVersion}`);
      logger.warn(`   Installing community compiler would be a downgrade!`);

      const action = await select({
        message: 'How would you like to handle this version conflict?',
        choices: [
          {
            value: 'keep_server',
            name: `Keep server's compiler (${existingVersion}) - recommended`,
          },
          {
            value: 'downgrade',
            name: `Replace with community compiler (${cleanTargetVersion}) - not recommended`,
          },
          {
            value: 'both',
            name: `Install both (community in compiler/ folder)`,
          },
        ],
        default: 'keep_server',
      });

      if (action === 'keep_server') {
        keepQawno = true;
        downgradeQawno = false;
        installCompilerFolder = false;
      } else if (action === 'downgrade') {
        keepQawno = false;
        downgradeQawno = true;
        installCompilerFolder = false;
      } else {
        keepQawno = true;
        downgradeQawno = false;
        installCompilerFolder = true;
        useCompilerFolder = true;
      }
    } else {
      keepQawno = await confirm({
        message: `Server has ${existingVersion}, community compiler is ${cleanTargetVersion}. Replace server's compiler?`,
        default: false,
      });
      if (keepQawno) {
        downgradeQawno = false;
      }
    }
  } else if (defaults.keepQawno !== undefined) {
    keepQawno = defaults.keepQawno;
    if (defaults.downgradeQawno !== undefined) {
      downgradeQawno = defaults.downgradeQawno;
    }
  }

  if (
    defaults.installCompilerFolder === undefined &&
    (!hasQawno || (keepQawno && !downgradeQawno && !installCompilerFolder))
  ) {
    installCompilerFolder = await confirm({
      message: 'Install community compiler in compiler/ folder?',
      default: true,
    });
  } else if (defaults.installCompilerFolder !== undefined) {
    installCompilerFolder = defaults.installCompilerFolder;
  }

  if (
    defaults.useCompilerFolder === undefined &&
    keepQawno &&
    installCompilerFolder &&
    hasQawno &&
    !downgradeQawno
  ) {
    useCompilerFolder = await confirm({
      message: 'Use compiler/ folder for builds (otherwise use qawno/)?',
      default: true,
    });
  } else if (defaults.useCompilerFolder !== undefined) {
    useCompilerFolder = defaults.useCompilerFolder;
  }

  if (defaults.downloadStdLib === undefined) {
    if (!stdLibAlreadyPresent) {
      downloadStdLib = await confirm({
        message: `Download ${isLegacySamp ? 'SA-MP' : 'open.mp'} standard library?`,
        default: true,
      });
    } else if (logger.getVerbosity() !== 'quiet') {
      logger.hint(
        'Standard library detected. Skipping download — remove existing includes if you need a fresh copy.'
      );
      downloadStdLib = false;
    }
  } else {
    if (stdLibAlreadyPresent && defaults.downloadStdLib && logger.getVerbosity() === 'verbose') {
      logger.detail(
        'Preset requests standard library download despite existing files'
      );
    }
    downloadStdLib = defaults.downloadStdLib;
  }

  return {
    downloadCompiler,
    compilerVersion,
    keepQawno,
    downgradeQawno,
    installCompilerFolder,
    useCompilerFolder,
    downloadStdLib,
    compilerDownloadUrl,
    stdLibDownloadUrl,
  };
}
async function checkExistingCompilerVersion(
  qawnoDir: string
): Promise<string | null> {
  const platform = process.platform;
  const exeExtension = platform === 'win32' ? '.exe' : '';
  const compilerPath = path.join(qawnoDir, `pawncc${exeExtension}`);

  if (!fs.existsSync(compilerPath)) {
    return null;
  }

  const tmp = require('os').tmpdir();
  const pwnTestFile = path.join(tmp, `__pawn_version_check_${Date.now()}.pwn`);
  const amxTestFile = path.join(
    process.cwd(),
    path.basename(pwnTestFile).replace(/\.pwn$/, '.amx')
  );
  const fsPromises = fs.promises;

  try {
    // Write minimal pawn file to check compiler version
    await fsPromises.writeFile(pwnTestFile, 'main() {}');

    const { spawn } = require('child_process');
    return await new Promise((resolve) => {
      const compiler = spawn(compilerPath, [pwnTestFile], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      });

      let output = '';
      let cleaned = false;
      const cleanup = () => {
        if (!cleaned) {
          cleaned = true;
          fsPromises.unlink(pwnTestFile).catch(() => {});
          fsPromises.unlink(amxTestFile).catch(() => {});
        }
      };

      const timeoutId = setTimeout(() => {
        compiler.kill();
        resolve(null);
        cleanup();
      }, 5000);

      compiler.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      compiler.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });

      compiler.on('close', () => {
        clearTimeout(timeoutId);
        const versionMatch = output.match(/Pawn compiler\s+([0-9.]+)/i);
        resolve(versionMatch ? versionMatch[1] : null);
        cleanup();
      });

      compiler.on('error', () => {
        clearTimeout(timeoutId);
        resolve(null);
        cleanup();
      });
    });
  } catch (error) {
    if (logger.getVerbosity() === 'verbose') {
      logger.detail(
        `Could not check existing compiler version: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
    try {
      await fsPromises.unlink(pwnTestFile);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

// Helper function to compare versions (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

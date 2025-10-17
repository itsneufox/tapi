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
  options: CommandOptions
): Promise<InitialAnswers> {
  const isLegacySamp = options.legacySamp;
  const defaultAuthor = configManager.getDefaultAuthor();
  const name =
    options.name ||
    (await input({
      message: 'Project name:',
      default: path.basename(process.cwd()),
    }));
  const description =
    options.description ||
    (await input({
      message: 'Project description:',
    }));
  const author =
    options.author ||
    (await input({
      message: 'Author:',
      default: defaultAuthor || '',
    }));
  const projectType = (await select({
    message: 'Project type:',
    choices: [
      { value: 'gamemode', name: 'gamemode' },
      { value: 'filterscript', name: 'filterscript' },
      { value: 'library', name: 'library' },
    ],
    default: 'gamemode',
  })) as 'gamemode' | 'filterscript' | 'library';
  const editor = (await select({
    message: 'Which editor are you using?',
    choices: [
      { value: 'VS Code', name: 'VS Code' },
      { value: 'Sublime Text', name: 'Sublime Text' },
      { value: 'Other/None', name: 'Other/None' },
    ],
    default: configManager.getEditor() || 'VS Code',
  })) as 'VS Code' | 'Sublime Text' | 'Other/None';
  const initGit = await confirm({
    message: 'Initialize Git repository?',
    default: true,
  });
  const downloadServer = await confirm({
    message: `Add ${isLegacySamp ? 'SA-MP' : 'open.mp'} server package?`,
    default: true,
  });
  return {
    name,
    description,
    author,
    projectType,
    addStdLib: true,
    initGit,
    downloadServer,
    editor,
  };
}

/**
 * Collect compiler installation preferences, handling existing installs and version conflicts.
 */
export async function promptForCompilerOptions(isLegacySamp: boolean = false): Promise<CompilerAnswers> {
  // Check if there's already a compiler in the current directory
  const hasExistingCompiler = 
    fs.existsSync(path.join(process.cwd(), 'pawno', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'pawno', 'pawncc')) ||
    fs.existsSync(path.join(process.cwd(), 'qawno', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'qawno', 'pawncc')) ||
    fs.existsSync(path.join(process.cwd(), 'compiler', 'pawncc.exe')) ||
    fs.existsSync(path.join(process.cwd(), 'compiler', 'pawncc'));

  // Only ask to download compiler if there's already one, otherwise always download
  const downloadCompiler = hasExistingCompiler
    ? await confirm({
        message: 'Download community pawn compiler? (A compiler already exists)',
        default: false,
      })
    : true;

  const stdLibAlreadyPresent = hasExistingStandardLibrary();
  let compilerVersion = 'latest';
  let keepQawno = true;
  let installCompilerFolder = false;
  let useCompilerFolder = false;
  let downloadStdLib = !stdLibAlreadyPresent;
  let downgradeQawno = false;

  if (!downloadCompiler) {
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

  compilerVersion = await input({
    message: 'Enter the compiler version (or "latest" for the latest version):',
    default: 'latest',
  });

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
    if (
      existingVersion &&
      compareVersions(cleanTargetVersion, existingVersion) === 0
    ) {
      // Already latest, no need to ask about keeping or downgrading
      keepQawno = true;
      downgradeQawno = false;
    } else if (existingVersion) {
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
          // both
          keepQawno = true;
          downgradeQawno = false;
          installCompilerFolder = true;
          useCompilerFolder = true;
        }
      } else {
        // Upgrade scenario
        keepQawno = await confirm({
          message: `Server has ${existingVersion}, community compiler is ${cleanTargetVersion}. Replace server's compiler?`,
          default: false,
        });
        if (keepQawno) {
          downgradeQawno = false;
        }
      }
    }
  }

  // Only ask about compiler/ folder if not already decided
  if (!hasQawno || (keepQawno && !downgradeQawno && !installCompilerFolder)) {
    installCompilerFolder = await confirm({
      message: 'Install community compiler in compiler/ folder?',
      default: true,
    });
  }

  // If both exist and not downgrading, ask which to use
  if (keepQawno && installCompilerFolder && hasQawno && !downgradeQawno) {
    useCompilerFolder = await confirm({
      message: 'Use compiler/ folder for builds (otherwise use qawno/)?',
      default: true,
    });
  }

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

// Helper function to check existing compiler version
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

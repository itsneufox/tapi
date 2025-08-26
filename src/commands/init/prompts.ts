import * as fs from 'fs';
import * as path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { getLatestCompilerVersion } from './compiler';
import { CommandOptions, InitialAnswers, CompilerAnswers } from './types';

export async function promptForInitialOptions(
  options: CommandOptions
): Promise<InitialAnswers> {
  const defaultAuthor = configManager.getDefaultAuthor();
  const name = options.name || (await input({
    message: 'Project name:',
    default: path.basename(process.cwd()),
  }));
  const description = options.description || (await input({
    message: 'Project description:',
  }));
  const author = options.author || (await input({
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
    message: 'Add open.mp server package?',
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

export async function promptForCompilerOptions(): Promise<CompilerAnswers> {
  // Only ask to download compiler if not Linux, otherwise always true
  const downloadCompiler = process.platform === 'linux' ? true : await confirm({
    message: 'Download community pawn compiler?',
    default: true,
  });

  let compilerVersion = 'latest';
  let keepQawno = true;
  let installCompilerFolder = false;
  let useCompilerFolder = false;
  let downloadStdLib = true;
  let downgradeQawno = false;

  if (!downloadCompiler) {
    // If not downloading, just ask about stdlib
    downloadStdLib = await confirm({
      message: 'Download open.mp standard library?',
      default: true,
    });
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
    if (existingVersion && compareVersions(cleanTargetVersion, existingVersion) === 0) {
      // Already latest, no need to ask about keeping or downgrading
      keepQawno = true;
      downgradeQawno = false;
    } else {
      // Only ask to keep if version differs
      keepQawno = await confirm({
        message: 'Keep existing qawno/ directory?',
        default: true,
      });
      if (keepQawno && existingVersion) {
        const isDowngrade = compareVersions(cleanTargetVersion, existingVersion) < 0;
        if (isDowngrade) {
          logger.warn(`Detected existing compiler version ${existingVersion} in qawno/`);
          logger.warn(`Community compiler version ${cleanTargetVersion} would be a downgrade!`);
          downgradeQawno = await confirm({
            message: `Replace compiler in qawno/ with older version ${cleanTargetVersion}?`,
            default: false,
          });
        }
      }
    }
  }

  // Only ask about compiler/ folder if not downgrading qawno
  if (!hasQawno || !keepQawno || !existingVersion || !downgradeQawno) {
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

  downloadStdLib = await confirm({
    message: 'Download open.mp standard library?',
    default: true,
  });

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

      let timeoutId = setTimeout(() => {
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
    logger.detail(
      `Could not check existing compiler version: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      await fsPromises.unlink(pwnTestFile);
    } catch {}
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

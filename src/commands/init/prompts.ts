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
  let downloadCompiler = true;
  if (process.platform !== 'linux') {
    downloadCompiler = await confirm({
      message: 'Download community pawn compiler?',
      default: true,
    });
  }

  let compilerVersion: string = 'latest';
  let keepQawno: boolean = true;
  let installCompilerFolder: boolean = false;
  let useCompilerFolder: boolean = false;
  let downloadStdLib: boolean = true;
  let downgradeQawno: boolean = false;

  if (downloadCompiler) {
    compilerVersion = await input({
      message:
        'Enter the compiler version (or "latest" for the latest version):',
      default: 'latest',
    });

    const qawnoDir = path.join(process.cwd(), 'qawno');
    const hasQawno = fs.existsSync(qawnoDir);

    if (hasQawno) {
      // Check existing compiler version
      const existingVersion = await checkExistingCompilerVersion(qawnoDir);
      const targetVersion =
        compilerVersion === 'latest'
          ? await getLatestCompilerVersion()
          : compilerVersion;
      const cleanTargetVersion = targetVersion.startsWith('v')
        ? targetVersion.substring(1)
        : targetVersion;

      // First question: Keep existing qawno?
      keepQawno = await confirm({
        message: 'Keep existing qawno/ directory?',
        default: true,
      });

      // If keeping qawno and we detected a version issue
      if (keepQawno && existingVersion) {
        const isDowngrade =
          compareVersions(cleanTargetVersion, existingVersion) < 0;

        if (isDowngrade) {
          logger.warn(
            `Detected existing compiler version ${existingVersion} in qawno/`
          );
          logger.warn(
            `Community compiler version ${cleanTargetVersion} would be a downgrade!`
          );

          downgradeQawno = await confirm({
            message: `Replace compiler in qawno/ with older version ${cleanTargetVersion}?`,
            default: false,
          });
        } else {
          logger.info(`Existing compiler version ${existingVersion} detected`);
          logger.info(
            `Will upgrade to community compiler version ${cleanTargetVersion}`
          );
        }
      }
    }

    // Second question: Create compiler folder?
    installCompilerFolder = await confirm({
      message: 'Install community compiler in compiler/ folder?',
      default: true,
    });

    // Third question: If both exist, which to use?
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

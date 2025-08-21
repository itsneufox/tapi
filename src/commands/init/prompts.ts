import * as fs from 'fs';
import * as path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import { configManager } from '../../utils/config';
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
  let keepQawno: boolean = false;
  let downloadStdLib: boolean = true;

  if (downloadCompiler) {
    compilerVersion = await input({
      message:
        'Enter the compiler version (or "latest" for the latest version):',
      default: 'latest',
    });

    const qawnoDir = path.join(process.cwd(), 'qawno');
    if (process.platform === 'win32' && fs.existsSync(qawnoDir)) {
      keepQawno = await confirm({
        message: 'Keep existing qawno folder alongside community compiler?',
        default: false,
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
    downloadStdLib,
  };
}
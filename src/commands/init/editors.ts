import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { createSpinner } from './utils';

export async function setupVSCodeIntegration(
  projectName: string
): Promise<void> {
  const vscodeSpinner = createSpinner('Setting up VS Code integration...');
  try {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const pawnctlDir = path.join(process.cwd(), '.pawnctl');
    if (!fs.existsSync(pawnctlDir)) {
      fs.mkdirSync(pawnctlDir, { recursive: true });
    }

    // get the starter script from main templates directory
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'common',
      'start-server.js'
    );
    const targetPath = path.join(pawnctlDir, 'start-server.js');

    fs.copyFileSync(templatePath, targetPath);
    logger.detail(`Copied start-server.js template to ${targetPath}`);

    // get vscode config files from folder templates/vscode
    const tasksConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'tasks.json'
    );
    const launchConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'launch.json'
    );
    const settingsConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'settings.json'
    );

    fs.copyFileSync(tasksConfigPath, path.join(vscodeDir, 'tasks.json'));
    logger.detail('Copied tasks.json template');

    fs.copyFileSync(launchConfigPath, path.join(vscodeDir, 'launch.json'));
    logger.detail('Copied launch.json template');

    fs.copyFileSync(settingsConfigPath, path.join(vscodeDir, 'settings.json'));
    logger.detail('Copied settings.json template');

    vscodeSpinner.succeed('VS Code configuration created');
  } catch (error) {
    vscodeSpinner.fail(
      `Could not set up VS Code integration: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

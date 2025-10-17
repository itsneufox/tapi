import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { createSpinner } from './utils';

/**
 * Configure VS Code tasks/settings for the initialized project.
 */
export async function setupVSCodeIntegration(
  _projectName: string
): Promise<void> {
  const vscodeSpinner = createSpinner('Setting up VS Code integration...');
  try {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const tapiDir = path.join(process.cwd(), '.tapi');
    if (!fs.existsSync(tapiDir)) {
      fs.mkdirSync(tapiDir, { recursive: true });
    }

    // No need for startup scripts - users can run `tapi start` directly

    // get vscode config files from folder templates/vscode
    const tasksConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'tasks.json'
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
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Copied tasks.json template');
    }

    fs.copyFileSync(settingsConfigPath, path.join(vscodeDir, 'settings.json'));
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Copied settings.json template');
    }

    vscodeSpinner.succeed('VS Code configuration created');
  } catch (error) {
    vscodeSpinner.fail(
      `Could not set up VS Code integration: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

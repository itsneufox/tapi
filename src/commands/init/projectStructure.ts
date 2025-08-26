import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { generatePackageManifest } from '../../core/manifest';
import { InitialAnswers } from './types';
import { initGitRepository } from './git';
import { setupVSCodeIntegration } from './editors';
import { createSpinner, readTemplate, readReadmeTemplate } from './utils';

export async function setupProjectStructure(
  initialAnswers: InitialAnswers
): Promise<void> {
  // Manifest
  await generatePackageManifest({
    name: initialAnswers.name,
    description: initialAnswers.description,
    author: initialAnswers.author,
    projectType: initialAnswers.projectType,
    addStdLib: initialAnswers.addStdLib,
  });
  logger.detail('Created .pawnctl/pawn.json');

  // README
  try {
    const readmeContent = readReadmeTemplate(
      initialAnswers.name,
      initialAnswers.description,
      initialAnswers.author,
      initialAnswers.projectType
    );
    fs.writeFileSync(path.join(process.cwd(), 'README.md'), readmeContent);
    logger.detail('Created README.md');
  } catch (error) {
    logger.error(
      `Failed to create README.md: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  // Directories
  const directories = [
    'gamemodes',
    'filterscripts',
    'plugins',
    'scriptfiles',
  ];
  let createdDirs = 0;
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      createdDirs++;
    }
  }
  logger.detail(`Created ${createdDirs} project directories`);

  // Main code file
  const gamemodeFile = path.join(
    process.cwd(),
    'gamemodes',
    `${initialAnswers.name}.pwn`
  );
  if (!fs.existsSync(gamemodeFile)) {
    try {
      const templateContent = readTemplate(
        initialAnswers.projectType,
        initialAnswers.name
      );
      let filePath = gamemodeFile;
      if (initialAnswers.projectType === 'filterscript') {
        filePath = path.join(
          process.cwd(),
          'filterscripts',
          `${initialAnswers.name}.pwn`
        );
      } else if (initialAnswers.projectType === 'library') {
        filePath = path.join(
          process.cwd(),
          'includes',
          `${initialAnswers.name}.inc`
        );
      }
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(filePath, templateContent);
      logger.detail(`Created ${path.relative(process.cwd(), filePath)}`);
    } catch (error) {
      logger.error(
        `Failed to create ${initialAnswers.projectType} file: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (initialAnswers.initGit) {
    try {
      await initGitRepository();
      logger.detail('Git repository initialized');
    } catch (error) {
      logger.error(
        `Could not initialize Git repository: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (initialAnswers.editor === 'VS Code') {
    try {
      await setupVSCodeIntegration(initialAnswers.name);
      logger.detail('VS Code integration set up');
    } catch (error) {
      // Error handling is inside the function
    }
  }
  // Summary at normal level
  logger.success('Project files and structure created');
}

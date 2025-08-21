import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { generatePackageManifest } from '../../core/manifest';
import { InitialAnswers } from './types';
import { initGitRepository } from './git';
import { setupVSCodeIntegration } from './editors';
import { createSpinner, readTemplate, readReadmeTemplate } from './utils';

export async function setupProjectStructure(initialAnswers: InitialAnswers): Promise<void> {
  // create manifest file
  const manifestSpinner = createSpinner('Creating project manifest...');
  await generatePackageManifest({
    name: initialAnswers.name,
    description: initialAnswers.description,
    author: initialAnswers.author,
    projectType: initialAnswers.projectType,
    addStdLib: initialAnswers.addStdLib,
  });
  manifestSpinner.succeed('Created pawn.json manifest file');

  // create README
  const readmeSpinner = createSpinner('Creating README.md...');
  try {
    const readmeContent = readReadmeTemplate(
      initialAnswers.name,
      initialAnswers.description,
      initialAnswers.author,
      initialAnswers.projectType
    );

    fs.writeFileSync(
      path.join(process.cwd(), 'README.md'),
      readmeContent
    );
    readmeSpinner.succeed('Created README.md file');
  } catch (error) {
    readmeSpinner.fail(
      `Failed to create README.md: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  // create project directories
  const dirSpinner = createSpinner('Setting up project directories...');
  const directories = [
    'gamemodes',
    'filterscripts',
    'includes',
    'plugins',
    'scriptfiles',
  ];
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  dirSpinner.succeed('Project directories created');

  // create project files
  const gamemodeFile = path.join(
    process.cwd(),
    'gamemodes',
    `${initialAnswers.name}.pwn`
  );
  if (!fs.existsSync(gamemodeFile)) {
    const codeSpinner = createSpinner(
      `Creating ${initialAnswers.projectType} code...`
    );

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
      codeSpinner.succeed(
        `Created ${initialAnswers.projectType} file: ${path.relative(process.cwd(), filePath)}`
      );
    } catch (error) {
      codeSpinner.fail(
        `Failed to create ${initialAnswers.projectType} file: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  // initialize git repository if requested
  if (initialAnswers.initGit) {
    const gitSpinner = createSpinner('Initializing Git repository...');
    try {
      await initGitRepository();
      gitSpinner.succeed('Git repository initialized');
    } catch (error) {
      gitSpinner.fail(
        `Could not initialize Git repository: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  // set up editor integration
  if (initialAnswers.editor === 'VS Code') {
    try {
      await setupVSCodeIntegration(initialAnswers.name);
    } catch (error) {
      // error handling is inside the function
    }
  }
}
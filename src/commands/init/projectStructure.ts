import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { generatePackageManifest } from '../../core/manifest';
import { InitialAnswers } from './types';
import { initGitRepository } from './git';
import { setupVSCodeIntegration } from './editors';
import { readTemplate, readReadmeTemplate } from './utils';
import { getAddonManager } from '../../core/addons';

/**
 * Generate manifest, project files, optional git repo, and editor integration during init.
 */
export async function setupProjectStructure(
  initialAnswers: InitialAnswers,
  isLegacySamp: boolean = false
): Promise<void> {
  // Call addon preInit hooks
  try {
    const addonManager = getAddonManager();
    const projectInfo = {
      name: initialAnswers.name,
      type: initialAnswers.projectType as 'gamemode' | 'filterscript' | 'library',
      path: process.cwd(),
      config: {
        description: initialAnswers.description,
        author: initialAnswers.author,
        legacySamp: isLegacySamp,
        addStdLib: initialAnswers.addStdLib
      }
    };
    
    await addonManager.getHookManager().executeHook('preInit', projectInfo);
  } catch (error) {
    logger.detail(`Addon preInit hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  // Manifest
  await generatePackageManifest({
    name: initialAnswers.name,
    description: initialAnswers.description,
    author: initialAnswers.author,
    projectType: initialAnswers.projectType,
    addStdLib: initialAnswers.addStdLib,
    legacySamp: isLegacySamp,
  });
  if (logger.getVerbosity() === 'verbose') {
    logger.detail('Created .tapi/pawn.json');
  }

  // Call addon postInit hooks
  try {
    const addonManager = getAddonManager();
    const projectInfo = {
      name: initialAnswers.name,
      type: initialAnswers.projectType as 'gamemode' | 'filterscript' | 'library',
      path: process.cwd(),
      config: {
        description: initialAnswers.description,
        author: initialAnswers.author,
        legacySamp: isLegacySamp,
        addStdLib: initialAnswers.addStdLib
      }
    };
    
    await addonManager.getHookManager().executeHook('postInit', projectInfo);
  } catch (error) {
    logger.detail(`Addon postInit hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  // README
  try {
    const readmeContent = readReadmeTemplate(
      initialAnswers.name,
      initialAnswers.description,
      initialAnswers.author,
      initialAnswers.projectType
    );
    fs.writeFileSync(path.join(process.cwd(), 'README.md'), readmeContent);
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Created README.md');
    }
  } catch (error) {
    logger.error(
      `Failed to create README.md: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  // Directories
  const directories = ['gamemodes', 'filterscripts', 'plugins', 'scriptfiles'];
  let createdDirs = 0;
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      createdDirs++;
    }
  }
  if (logger.getVerbosity() === 'verbose' && createdDirs > 0) {
    logger.detail(`Created ${createdDirs} project directories`);
  }

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
      if (logger.getVerbosity() === 'verbose') {
        logger.detail(`Created ${path.relative(process.cwd(), filePath)}`);
      }
    } catch (error) {
      logger.error(
        `Failed to create ${initialAnswers.projectType} file: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (initialAnswers.initGit) {
    try {
      await initGitRepository();
      if (logger.getVerbosity() === 'verbose') {
        logger.detail('Git repository initialized');
      }
    } catch (error) {
      logger.error(
        `Could not initialize Git repository: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (initialAnswers.editor === 'VS Code') {
    try {
      await setupVSCodeIntegration(initialAnswers.name);
      if (logger.getVerbosity() === 'verbose') {
        logger.detail('VS Code integration set up');
      }
    } catch {
      // Error handling is inside the function
    }
  }

  // Summary at verbose level
  if (logger.getVerbosity() === 'verbose') {
    logger.success('Project files and structure created');
  }
}

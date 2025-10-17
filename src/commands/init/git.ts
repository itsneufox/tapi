import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { logger } from '../../utils/logger';

/**
 * Initialize a Git repository, create .gitignore, and perform the first commit.
 */
export async function initGitRepository(): Promise<void> {
  try {
    const git = simpleGit();
    await git.init();

    try {
      const gitignoreTemplatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'common',
        'gitignore.txt'
      );

      if (!fs.existsSync(gitignoreTemplatePath)) {
        throw new Error(
          `Gitignore template not found at: ${gitignoreTemplatePath}`
        );
      }

      const gitignoreContent = fs.readFileSync(gitignoreTemplatePath, 'utf8');
      if (logger.getVerbosity() === 'verbose') {
        logger.detail(
          `Using gitignore template from: ${gitignoreTemplatePath}`
        );
      }

      fs.writeFileSync(
        path.join(process.cwd(), '.gitignore'),
        gitignoreContent.trim()
      );
      logger.routine(
        'Created .gitignore file with common PAWN-specific entries'
      );

      try {
        await git.add('.');
        await git.commit('Initial commit: Initialize project structure', {
          '--no-gpg-sign': null,
        });
        logger.routine('Created initial Git commit');
      } catch (commitError) {
        logger.warn(
          'Could not create initial commit. You may need to commit the changes manually.'
        );
        logger.warn(
          `Git commit error: ${commitError instanceof Error ? commitError.message : 'unknown error'}`
        );
      }
    } catch (gitignoreError) {
      logger.warn(
        `Could not create .gitignore file: ${gitignoreError instanceof Error ? gitignoreError.message : 'unknown error'}`
      );
    }
  } catch (error) {
    logger.warn(
      'Failed to initialize Git repository. Git features will be disabled.'
    );
    logger.warn(
      `Git error: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

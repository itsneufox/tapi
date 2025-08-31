import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as cliProgress from 'cli-progress';
import { IncomingMessage } from 'http';
import ora, { Ora } from 'ora';
import { logger } from '../../utils/logger';

/**
 * Creates a spinner based on verbosity settings
 */
export function createSpinner(text: string): Ora {
  if (logger.getVerbosity() === 'quiet') {
    // Create a spinner but don't display it in quiet mode
    const spinner = ora({
      text,
      isSilent: true,
    });
    return spinner.start();
  }
  return ora(text).start();
}

/**
 * Cleans up files in a directory, keeping the specified files
 */
export function cleanupFiles(directory: string, keepItems: string[]): number {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  try {
    const entries = fs.readdirSync(directory);
    let removedCount = 0;

    for (const entry of entries) {
      if (keepItems.includes(entry)) {
        continue;
      }

      const entryPath = path.join(directory, entry);
      const isDir = fs.statSync(entryPath).isDirectory();

      try {
        if (isDir) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(entryPath);
        }

        if (logger.getVerbosity() === 'verbose') {
          logger.detail(
            `Removed ${isDir ? 'directory' : 'file'}: ${directory}/${entry}`
          );
        }
        removedCount++;
      } catch (err) {
        logger.warn(
          `Failed to remove ${entryPath}: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  } catch (err) {
    logger.warn(
      `Could not access directory ${directory}: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    return 0;
  }
}

/**
 * Cleans up gamemode files, keeping only the working file
 */
export function cleanupGamemodeFiles(workingFile: string): void {
  const gamemodesDir = path.join(process.cwd(), 'gamemodes');
  if (!fs.existsSync(gamemodesDir)) {
    return;
  }

  try {
    const entries = fs.readdirSync(gamemodesDir);
    let removedCount = 0;

    for (const entry of entries) {
      if (
        entry === workingFile ||
        entry === `${path.parse(workingFile).name}.inc`
      ) {
        continue;
      }

      if (entry.endsWith('.pwn') || entry.endsWith('.amx')) {
        const filePath = path.join(gamemodesDir, entry);

        try {
          fs.unlinkSync(filePath);
          if (logger.getVerbosity() === 'verbose') {
            logger.detail(`Removed gamemode file: ${entry}`);
          }
          removedCount++;
        } catch (err) {
          logger.warn(
            `Failed to remove ${filePath}: ${err instanceof Error ? err.message : 'unknown error'}`
          );
        }
      }
    }

    if (removedCount > 0) {
      logger.routine(
        `Cleaned up gamemodes directory (removed ${removedCount} files)`
      );
    }
  } catch (err) {
    logger.warn(
      `Could not access gamemode directory: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

/**
 * Gets the path to a template file based on its type
 */
export function getTemplatePath(type: string): string {
  // Try multiple possible template locations
  const possiblePaths = [
    // In built dist directory
    path.join(__dirname, '..', '..', '..', 'templates', 'projects'),
    // In development src directory
    path.join(__dirname, '..', '..', '..', 'src', 'templates', 'projects'),
    // Alternative dist location
    path.join(__dirname, '..', '..', 'templates', 'projects'),
  ];

  let templateFile: string;
  switch (type) {
    case 'gamemode':
      templateFile = 'gamemode.pwn';
      break;
    case 'filterscript':
      templateFile = 'filterscript.pwn';
      break;
    case 'library':
      templateFile = 'library.inc';
      break;
    default:
      throw new Error(`Unknown template type: ${type}`);
  }

  // Check each possible path
  for (const basePath of possiblePaths) {
    const fullPath = path.join(basePath, templateFile);
    if (fs.existsSync(fullPath)) {
      if (logger.getVerbosity() === 'verbose') {
        logger.detail(`Found template at: ${fullPath}`);
      }
      return fullPath;
    }
  }

  // If not found, log available paths for debugging and throw error
  logger.error(`Template file not found: ${templateFile}`);
  if (logger.getVerbosity() === 'verbose') {
    logger.detail('Searched in the following locations:');
    possiblePaths.forEach((p) => {
      logger.detail(`  - ${p} (exists: ${fs.existsSync(p)})`);
    });
  }

  throw new Error(
    `Template file not found: ${templateFile}. Make sure templates are properly installed.`
  );
}

/**
 * Reads a template file and replaces placeholders
 */
export function readTemplate(type: string, name: string): string {
  const templatePath = getTemplatePath(type);

  try {
    let template = fs.readFileSync(templatePath, 'utf8');
    template = template.replace(/\{\{name\}\}/g, name);
    return template;
  } catch (error) {
    logger.error(
      `Failed to read template file: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

/**
 * Reads and processes the README template
 */
export function readReadmeTemplate(
  name: string,
  description: string,
  author: string,
  projectType: 'gamemode' | 'filterscript' | 'library'
): string {
  // Try multiple possible README template locations
  const possiblePaths = [
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'templates',
      'projects',
      'README.md'
    ),
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'templates',
      'projects',
      'README.md'
    ),
    path.join(__dirname, '..', '..', 'templates', 'projects', 'README.md'),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      try {
        let template = fs.readFileSync(templatePath, 'utf8');

        template = template.replace(/\{\{name\}\}/g, name);
        template = template.replace(
          /\{\{description\}\}/g,
          description || 'A PAWN project for open.mp'
        );
        template = template.replace(/\{\{author\}\}/g, author || 'Anonymous');
        template = template.replace(/\{\{projectType\}\}/g, projectType);

        const projectFolder =
          projectType === 'gamemode'
            ? 'gamemodes/'
            : projectType === 'filterscript'
              ? 'filterscripts/'
              : 'includes/';
        template = template.replace(/\{\{projectFolder\}\}/g, projectFolder);

        return template;
      } catch (error) {
        logger.warn(
          `Failed to read README template from ${templatePath}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        continue;
      }
    }
  }

  // No fallback - throw error
  logger.error('README template not found');
  if (logger.getVerbosity() === 'verbose') {
    logger.detail('Searched in the following locations:');
    possiblePaths.forEach((p) => {
      logger.detail(`  - ${p} (exists: ${fs.existsSync(p)})`);
    });
  }

  throw new Error(
    'README template not found. Make sure templates are properly installed.'
  );
}

/**
 * Downloads a file from a URL with progress reporting
 */
export async function downloadFileWithProgress(
  url: string,
  filename: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(process.cwd(), filename);
    const file = fs.createWriteStream(filePath);

    const progressBar = new cliProgress.SingleBar({
      format:
        'Downloading [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} KB',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    });

    let receivedBytes = 0;
    let totalBytes = 0;

    const req = https
      .get(url, { timeout: 10000 }, (response: IncomingMessage) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            if (logger.getVerbosity() === 'verbose') {
              logger.routine(
                `Following redirect to ${response.headers.location}`
              );
            }

            req.destroy();

            const redirectReq = https
              .get(
                response.headers.location,
                { timeout: 10000 },
                (redirectResponse: IncomingMessage) => {
                  if (redirectResponse.headers['content-length']) {
                    totalBytes = parseInt(
                      redirectResponse.headers['content-length'],
                      10
                    );
                    progressBar.start(Math.floor(totalBytes / 1024), 0);
                  }

                  redirectResponse.pipe(file);

                  redirectResponse.on('data', (chunk: Buffer) => {
                    receivedBytes += chunk.length;
                    if (totalBytes > 0) {
                      progressBar.update(Math.floor(receivedBytes / 1024));
                    }
                  });

                  file.on('finish', () => {
                    progressBar.stop();
                    file.close();
                    redirectReq.destroy();
                    logger.routine(`File downloaded to ${filename}`);
                    resolve();
                  });
                }
              )
              .on('error', (err: Error) => {
                progressBar.stop();
                file.close();
                fs.unlink(filePath, () => {});
                reject(err);
              });
          }
        } else if (response.statusCode === 200) {
          if (response.headers['content-length']) {
            totalBytes = parseInt(response.headers['content-length'], 10);
            progressBar.start(Math.floor(totalBytes / 1024), 0);
          }

          response.pipe(file);

          response.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0) {
              progressBar.update(Math.floor(receivedBytes / 1024));
            }
          });

          file.on('finish', () => {
            progressBar.stop();
            file.close();
            req.destroy();
            logger.routine(`File downloaded to ${filename}`);
            resolve();
          });
        } else {
          progressBar.stop();
          file.close();
          req.destroy();
          fs.unlink(filePath, () => {});
          reject(
            new Error(
              `Server responded with ${response.statusCode}: ${response.statusMessage}`
            )
          );
        }
      })
      .on('error', (err: Error) => {
        progressBar.stop();
        file.close();
        req.destroy();
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}

/**
 * Gets the latest version of a GitHub repository
 */
export async function getLatestGitHubVersion(
  repo: string,
  userAgent = 'pawnctl'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          headers: {
            'User-Agent': userAgent,
          },
          timeout: 10000,
        },
        (response: IncomingMessage) => {
          let data = '';
          response.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });

          response.on('end', () => {
            try {
              req.destroy();

              const release = JSON.parse(data);
              if (release.tag_name) {
                resolve(release.tag_name);
              } else {
                reject(new Error('Could not find latest version tag'));
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      )
      .on('error', (err: Error) => {
        req.destroy();
        reject(err);
      });
  });
}

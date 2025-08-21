import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import simpleGit from 'simple-git';
import { logger } from '../../utils/logger';
import { CompilerAnswers } from './types';
import { createSpinner } from './utils';
import { downloadFileWithProgress } from './serverDownload';

export async function setupCompiler(compilerAnswers: CompilerAnswers): Promise<void> {
  if (compilerAnswers.downloadCompiler) {
    try {
      await downloadCompiler(
        compilerAnswers.compilerVersion,
        compilerAnswers.keepQawno
      );
    } catch (error) {
      // error handled within download function
    }
  }

  if (compilerAnswers.downloadStdLib) {
    try {
      await downloadopenmpStdLib();
    } catch (error) {
      // error handled within download function
    }
  }
}

export async function downloadCompiler(
  versionInput: string,
  keepQawno: boolean = false
): Promise<void> {
  let version =
    versionInput === 'latest' ? await getLatestCompilerVersion() : versionInput;

  if (version.startsWith('v')) {
    version = version.substring(1);
  }

  const compilerTmpDir = path.join(process.cwd(), 'compiler_temp');
  if (fs.existsSync(compilerTmpDir)) {
    try {
      logger.detail(`Removing existing extract directory at ${compilerTmpDir}`);
      fs.rmSync(compilerTmpDir, { recursive: true, force: true });
      logger.detail('Successfully removed existing extract directory');
    } catch (err) {
      logger.warn(
        `Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      logger.warn('Proceeding anyway, but cleanup may be incomplete');
    }
  }
  
  logger.routine(`Creating temporary extract directory at ${compilerTmpDir}`);
  fs.mkdirSync(compilerTmpDir, { recursive: true });

  let downloadUrl: string, filename: string;
  switch (process.platform) {
    case 'win32': {
      downloadUrl = `https://github.com/pawn-lang/compiler/releases/download/v${version}/pawnc-${version}-windows.zip`;
      filename = `pawnc-${version}-windows.zip`;
      break;
    }
    case 'linux': {
      downloadUrl = `https://github.com/pawn-lang/compiler/releases/download/v${version}/pawnc-${version}-linux.tar.gz`;
      filename = `pawnc-${version}-linux.tar.gz`;
      break;
    }
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  const downloadCompilerSpinner = createSpinner('Downloading compiler...');
  try {
    await downloadFileWithProgress(downloadUrl, `compiler_temp/${filename}`);
    downloadCompilerSpinner.succeed('Compiler downloaded successfully');
  } catch (error) {
    downloadCompilerSpinner.fail(
      `Failed to download compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      fs.rmSync(path.join(process.cwd(), 'compiler_temp'), {
        recursive: true,
        force: true,
      });
    } catch {
      // ignore cleanup error
    }
    throw error;
  }

  const extractCompilerSpinner = createSpinner('Extracting compiler...');
  try {
    await extractCompilerPackage(
      path.join(process.cwd(), 'compiler_temp', filename)
    );
    extractCompilerSpinner.succeed('Compiler extracted successfully');
  } catch (error) {
    extractCompilerSpinner.fail(
      `Failed to extract compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }

  // remove qawno directory if it exists and user chose not to keep it
  const qawnoDir = path.join(process.cwd(), 'qawno');
  if (fs.existsSync(qawnoDir) && !keepQawno) {
    const removeQawnoSpinner = createSpinner('Removing qawno directory...');
    try {
      fs.rmSync(qawnoDir, { recursive: true, force: true });
      removeQawnoSpinner.succeed('Removed qawno directory');
      logger.warn('Replaced qawno with community compiler');
    } catch (error) {
      removeQawnoSpinner.fail(
        `Failed to remove qawno directory: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      logger.warn('You may need to manually remove the qawno directory');
    }
  } else if (fs.existsSync(qawnoDir) && keepQawno) {
    logger.info('Keeping qawno directory alongside community compiler');
  }

  const cleanupCompilerSpinner = createSpinner(
    'Cleaning up downloaded compiler files...'
  );
  try {
    fs.rmSync(path.join(process.cwd(), 'compiler_temp'), {
      recursive: true,
      force: true,
    });
    cleanupCompilerSpinner.succeed('Cleaned up downloaded compiler folder');
  } catch (error) {
    cleanupCompilerSpinner.fail(
      `Failed to clean up compiler folder: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

export async function downloadopenmpStdLib(): Promise<void> {
  const spinner = createSpinner('Downloading open.mp standard library...');

  try {
    const includesDir = path.resolve(process.cwd(), 'includes');
    const ompStdLibDir = includesDir;

    if (!includesDir.startsWith(process.cwd())) {
      throw new Error(
        'Invalid path: includes directory is outside the project root'
      );
    }

    // ensure the directory exists
    if (!fs.existsSync(includesDir)) {
      fs.mkdirSync(includesDir, { recursive: true });
    }

    // check if the directory is empty
    const files = fs.readdirSync(ompStdLibDir);
    if (files.length > 0) {
      spinner.info('open.mp standard library already exists');
      return;
    }

    const git = simpleGit();
    await git.clone(
      'https://github.com/openmultiplayer/omp-stdlib.git',
      ompStdLibDir,
      ['--depth=1']
    );
    const unnecessaryFilesAndDirs = [
      'README.md',
      '.git',
      'documentation',
      '.editorconfig',
      '.gitattributes',
      'LICENSE.md',
      'pawndoc.xsl',
    ];

    for (const item of unnecessaryFilesAndDirs) {
      const itemPath = path.resolve(ompStdLibDir, item);

      if (!itemPath.startsWith(ompStdLibDir)) {
        logger.warn(`Skipping invalid path: ${itemPath}`);
        continue;
      }

      if (fs.existsSync(itemPath)) {
        try {
          if (fs.statSync(itemPath).isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            logger.detail(`Removed directory: ${item}`);
          } else {
            fs.unlinkSync(itemPath);
            logger.detail(`Removed file: ${item}`);
          }
        } catch (error) {
          logger.warn(
            `Failed to remove ${item}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }

    spinner.succeed(
      'Successfully downloaded and cleaned up open.mp standard library'
    );
  } catch (error) {
    spinner.fail(
      `Failed to download standard library: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    logger.warn(
      'You may need to manually download the standard library from https://github.com/openmultiplayer/omp-stdlib'
    );
  }
}

export async function getLatestCompilerVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        'https://api.github.com/repos/pawn-lang/compiler/releases/latest',
        {
          headers: {
            'User-Agent': 'pawnctl',
          },
          timeout: 10000,
        },
        (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
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
      .on('error', (err) => {
        req.destroy();
        reject(err);
      });
  });
}

export async function extractCompilerPackage(filePath: string): Promise<void> {
  switch (process.platform) {
    case 'linux':
    case 'win32': {
      try {
        const extractDir = path.join(process.cwd(), 'compiler_temp');

        if (filePath.endsWith('.zip')) {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(filePath);
          zip.extractAllTo(extractDir, true);
        } else if (filePath.endsWith('.tar.gz')) {
          const tar = require('tar');
          await tar.extract({
            file: filePath,
            cwd: extractDir,
          });
        }

        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup failure
        }

        // get folder in the extracted directory
        const folderName = fs.readdirSync(extractDir)[0];

        let copiedFiles = 0;

        if (!fs.existsSync(path.join(process.cwd(), 'compiler'))) {
          fs.mkdirSync(path.join(process.cwd(), 'compiler'), {
            recursive: true,
          });
          logger.detail(
            `Created compiler directory at ${path.join(process.cwd(), 'compiler')}`
          );
        }

        const copyProgress = createSpinner(
          'Copying compiler files to project...'
        );

        const binContents = fs.readdirSync(
          path.join(extractDir, folderName, 'bin')
        );
        for (const file of binContents) {
          const sourcePath = path.join(extractDir, folderName, 'bin', file);
          const destPath = path.join(process.cwd(), 'compiler', file);

          if (!fs.existsSync(destPath)) {
            try {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to compiler/`);
              copiedFiles++;
            } catch (err) {
              if (err instanceof Error) {
                logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
              } else {
                logger.warn(`Could not copy ${sourcePath}: Unknown error`);
              }
            }
          }
        }

        if (process.platform == 'linux') {
          // lib doesn't exist on Windows
          const libContents = fs.readdirSync(
            path.join(extractDir, folderName, 'lib')
          );
          for (const file of libContents) {
            const sourcePath = path.join(extractDir, folderName, 'lib', file);
            const destPath = path.join(process.cwd(), 'compiler', file);

            if (!fs.existsSync(destPath)) {
              try {
                fs.copyFileSync(sourcePath, destPath);
                logger.detail(`Copied file: ${file} to compiler/`);
                copiedFiles++;
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
                } else {
                  logger.warn(`Could not copy ${sourcePath}: Unknown error`);
                }
              }
            }
          }
        }

        copyProgress.succeed(
          `Copied ${copiedFiles} compiler files to compiler`
        );
      } catch (error) {
        logger.error(
          `Failed to extract compiler package: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        throw error;
      }
      break;
    }
    default:
      throw new Error(`Platform not implemented: ${process.platform}`);
  }
}
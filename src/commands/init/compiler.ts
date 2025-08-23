import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import simpleGit from 'simple-git';
import { logger } from '../../utils/logger';
import { CompilerAnswers } from './types';
import { createSpinner } from './utils';
import { downloadFileWithProgress } from './serverDownload';

export async function setupCompiler(
  compilerAnswers: CompilerAnswers
): Promise<void> {
  if (compilerAnswers.downloadCompiler) {
    try {
      await downloadCompiler(
        compilerAnswers.compilerVersion,
        compilerAnswers.keepQawno !== false, // default to true if undefined
        compilerAnswers.installCompilerFolder || false,
        compilerAnswers.downgradeQawno || false
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
  keepQawno: boolean = true,
  installCompilerFolder: boolean = false,
  downgradeQawno: boolean = false
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
    } catch (err) {
      logger.warn(
        `Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

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
      fs.rmSync(compilerTmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
    throw error;
  }

  const extractCompilerSpinner = createSpinner('Extracting compiler...');
  try {
    await extractCompilerPackage(
      path.join(compilerTmpDir, filename),
      keepQawno,
      installCompilerFolder,
      downgradeQawno
    );
    extractCompilerSpinner.succeed('Compiler extracted successfully');
  } catch (error) {
    extractCompilerSpinner.fail(
      `Failed to extract compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }

  const cleanupSpinner = createSpinner(
    'Cleaning up downloaded compiler files...'
  );
  try {
    fs.rmSync(compilerTmpDir, { recursive: true, force: true });
    cleanupSpinner.succeed('Cleaned up downloaded compiler folder');
  } catch (error) {
    cleanupSpinner.fail(
      `Failed to clean up compiler folder: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

export async function downloadopenmpStdLib(
  targetLocation?: 'qawno' | 'compiler'
): Promise<void> {
  const spinner = createSpinner('Downloading open.mp standard library...');

  try {
    // Determine where to install based on which compiler setup exists
    let includesDir: string;
    let includesDirName: string;

    if (
      targetLocation === 'qawno' ||
      fs.existsSync(path.join(process.cwd(), 'qawno'))
    ) {
      includesDir = path.resolve(process.cwd(), 'qawno', 'include');
      includesDirName = 'qawno/include';
    } else if (
      targetLocation === 'compiler' ||
      fs.existsSync(path.join(process.cwd(), 'compiler'))
    ) {
      includesDir = path.resolve(process.cwd(), 'compiler', 'include');
      includesDirName = 'compiler/include';
    } else {
      // Fallback - doubt we will ever hit this
      throw new Error(
        'No qawno/ or compiler/ directory found. Cannot install standard library.'
      );
    }

    if (!includesDir.startsWith(process.cwd())) {
      throw new Error(
        'Invalid path: includes directory is outside the project root'
      );
    }

    // Ensure the directory exists
    if (!fs.existsSync(includesDir)) {
      fs.mkdirSync(includesDir, { recursive: true });
      logger.detail(`Created directory: ${includesDirName}`);
    }

    // Check if standard library files already exist
    const files = fs.readdirSync(includesDir);
    const hasStdLibFiles = files.some(
      (file) =>
        file === 'a_samp.inc' || file === 'open.mp' || file.endsWith('.inc')
    );

    if (hasStdLibFiles) {
      spinner.info(
        `Standard library files already exist in ${includesDirName}, skipping download`
      );
      logger.info(
        'If you want to update the standard library, please remove existing .inc files first'
      );
      return;
    }

    const git = simpleGit();
    await git.clone(
      'https://github.com/openmultiplayer/omp-stdlib.git',
      includesDir,
      ['--depth=1']
    );

    // Clean up unnecessary files
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
      const itemPath = path.resolve(includesDir, item);

      if (!itemPath.startsWith(includesDir)) {
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
      `Successfully installed open.mp standard library to ${includesDirName}`
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

export async function extractCompilerPackage(
  filePath: string,
  keepQawno: boolean,
  installCompilerFolder: boolean,
  downgradeQawno: boolean = false
): Promise<void> {
  try {
    const extractDir = path.join(process.cwd(), 'compiler_temp');

    // Extract the archive
    if (filePath.endsWith('.zip')) {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractDir, true);
    } else if (filePath.endsWith('.tar.gz')) {
      const tar = require('tar');
      await tar.extract({ file: filePath, cwd: extractDir });
    }

    fs.unlinkSync(filePath);
    const folderName = fs.readdirSync(extractDir)[0];

    // Handle qawno
    const qawnoDir = path.join(process.cwd(), 'qawno');
    if (!keepQawno && fs.existsSync(qawnoDir)) {
      logger.routine('Removing existing qawno directory');
      fs.rmSync(qawnoDir, { recursive: true, force: true });
      logger.detail('Existing qawno directory removed');
    }

    let installations = [];

    // Install in qawno/ if keeping qawno or if not installing compiler folder
    if (keepQawno || !installCompilerFolder) {
      const shouldUpdateQawno = !keepQawno || downgradeQawno;

      if (shouldUpdateQawno) {
        await installCompilerFiles(
          extractDir,
          folderName,
          qawnoDir,
          'qawno/',
          true
        );
        installations.push('qawno/ (updated)');
      } else {
        logger.routine('Preserving existing qawno/ compiler');
        installations.push('qawno/ (preserved)');
      }
    }

    // Install in compiler/ folder if requested
    if (installCompilerFolder) {
      const compilerDir = path.join(process.cwd(), 'compiler');
      await installCompilerFiles(
        extractDir,
        folderName,
        compilerDir,
        'compiler/',
        true
      );
      installations.push('compiler/');
    }

    // Show installation summary
    logger.newline();
    logger.subheading('Compiler installation summary:');
    logger.keyValue('Result', installations.join(', '));
  } catch (error) {
    logger.error(
      `Failed to extract compiler package: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

async function installCompilerFiles(
  extractDir: string,
  folderName: string,
  targetDir: string,
  targetDescription: string,
  overwrite: boolean = true
): Promise<number> {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Always create include subdirectory for compiler setups
  const includeDir = path.join(targetDir, 'include');
  if (!fs.existsSync(includeDir)) {
    fs.mkdirSync(includeDir, { recursive: true });
    logger.detail(
      `Created ${targetDescription}include/ directory for standard library`
    );
  }

  let copiedFiles = 0;
  let skippedFiles = 0;

  // Copy bin contents (compiler executables)
  const binDir = path.join(extractDir, folderName, 'bin');
  if (fs.existsSync(binDir)) {
    const binContents = fs.readdirSync(binDir);
    for (const file of binContents) {
      const sourcePath = path.join(binDir, file);
      const destPath = path.join(targetDir, file);

      try {
        if (!overwrite && fs.existsSync(destPath)) {
          logger.detail(`Preserved existing ${file} in ${targetDescription}`);
          skippedFiles++;
          continue;
        }

        fs.copyFileSync(sourcePath, destPath);
        logger.detail(`Installed ${file} to ${targetDescription}`);
        copiedFiles++;
      } catch (err) {
        logger.warn(
          `Could not copy ${file}: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }
  }

  // Copy lib contents (Linux only - shared libraries)
  if (process.platform === 'linux') {
    const libDir = path.join(extractDir, folderName, 'lib');
    if (fs.existsSync(libDir)) {
      const libContents = fs.readdirSync(libDir);
      for (const file of libContents) {
        const sourcePath = path.join(libDir, file);
        const destPath = path.join(targetDir, file);

        try {
          if (!overwrite && fs.existsSync(destPath)) {
            logger.detail(
              `Preserved existing library ${file} in ${targetDescription}`
            );
            skippedFiles++;
            continue;
          }

          fs.copyFileSync(sourcePath, destPath);
          logger.detail(`Installed library ${file} to ${targetDescription}`);
          copiedFiles++;
        } catch (err) {
          logger.warn(
            `Could not copy library ${file}: ${err instanceof Error ? err.message : 'unknown error'}`
          );
        }
      }
    }
  }

  if (overwrite || copiedFiles > 0) {
    logger.routine(
      `Installed ${copiedFiles} compiler files to ${targetDescription}`
    );
  }
  if (skippedFiles > 0) {
    logger.routine(
      `Preserved ${skippedFiles} existing files in ${targetDescription}`
    );
  }

  return copiedFiles;
}

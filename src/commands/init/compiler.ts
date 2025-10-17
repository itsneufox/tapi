import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import simpleGit from 'simple-git';
import { logger } from '../../utils/logger';
import { CompilerAnswers } from './types';
import { downloadFileWithProgress } from './serverDownload';

/**
 * Install the compiler and standard library based on setup answers.
 */
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
      if (logger.getVerbosity() !== 'quiet') {
        logger.success('✅ Compiler installed');
      }
    } catch {
      // error handled within download function
    }
  }

  if (compilerAnswers.downloadStdLib) {
    try {
      await downloadopenmpStdLib();
      if (logger.getVerbosity() !== 'quiet') {
        logger.success('✅ Standard library installed');
      }
    } catch {
      // error handled within download function
    }
  }
}

/**
 * Determine which GitHub repository hosts the requested compiler version.
 */
function getCompilerRepository(version: string): {
  user: string;
  repo: string;
} {
  // Remove 'v' prefix if present for comparison
  const versionNumber = version.startsWith('v')
    ? version.substring(1)
    : version;

  // Parse version parts for comparison
  const [major, minor, patch] = versionNumber.split('.').map(Number);

  // 3.10.11 and onwards use openmultiplayer repo
  if (
    major > 3 ||
    (major === 3 && minor > 10) ||
    (major === 3 && minor === 10 && patch >= 11)
  ) {
    return { user: 'openmultiplayer', repo: 'compiler' };
  }

  // 3.10.10 and older use pawn-lang repo
  return { user: 'pawn-lang', repo: 'compiler' };
}

/**
 * Download and extract the specified compiler version to the project.
 */
export async function downloadCompiler(
  versionInput: string,
  keepQawno: boolean = true,
  installCompilerFolder: boolean = false,
  downgradeQawno: boolean = false
): Promise<void> {
  const version =
    versionInput === 'latest' ? await getLatestCompilerVersion() : versionInput;

  // Store original version with 'v' for tag, and clean version for filenames
  const tagVersion = version.startsWith('v') ? version : `v${version}`;
  const cleanVersion = version.startsWith('v') ? version.substring(1) : version;

  const { user, repo } = getCompilerRepository(cleanVersion);

  const compilerTmpDir = path.join(process.cwd(), 'compiler_temp');
  if (fs.existsSync(compilerTmpDir)) {
    try {
      if (logger.getVerbosity() === 'verbose') {
        logger.detail(
          `Removing existing extract directory at ${compilerTmpDir}`
        );
      }
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
      downloadUrl = `https://github.com/${user}/${repo}/releases/download/${tagVersion}/pawnc-${cleanVersion}-windows.zip`;
      filename = `pawnc-${cleanVersion}-windows.zip`;
      break;
    }
    case 'linux': {
      downloadUrl = `https://github.com/${user}/${repo}/releases/download/${tagVersion}/pawnc-${cleanVersion}-linux.tar.gz`;
      filename = `pawnc-${cleanVersion}-linux.tar.gz`;
      break;
    }
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  try {
    if (logger.getVerbosity() === 'verbose') {
      logger.detail(`Downloading compiler from: ${downloadUrl}`);
    }
    await downloadFileWithProgress(downloadUrl, `compiler_temp/${filename}`);
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Compiler downloaded');
    }
  } catch (error) {
    logger.error(
      `Failed to download compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      fs.rmSync(compilerTmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
    throw error;
  }

  try {
    await extractCompilerPackage(
      path.join(compilerTmpDir, filename),
      keepQawno,
      installCompilerFolder,
      downgradeQawno
    );
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Compiler extracted');
    }
  } catch (error) {
    logger.error(
      `Failed to extract compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }

  try {
    fs.rmSync(compilerTmpDir, { recursive: true, force: true });
    if (logger.getVerbosity() === 'verbose') {
      logger.detail('Cleaned up downloaded compiler folder');
    }
  } catch (error) {
    logger.error(
      `Failed to clean up compiler folder: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

/**
 * Retrieve and install the open.mp standard library into the active compiler directory.
 */
export async function downloadopenmpStdLib(
  targetLocation?: 'qawno' | 'compiler'
): Promise<void> {
  // Only show spinner in verbose mode
  if (logger.getVerbosity() === 'verbose') {
    logger.detail('Downloading open.mp standard library...');
  }

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
      if (logger.getVerbosity() === 'verbose') {
        logger.detail(`Created directory: ${includesDirName}`);
      }
    }

    // Check if standard library files already exist
    const files = fs.readdirSync(includesDir);
    const hasStdLibFiles = files.some(
      (file) =>
        file === 'a_samp.inc' || file === 'open.mp' || file.endsWith('.inc')
    );

    if (hasStdLibFiles) {
      logger.info(
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
            if (logger.getVerbosity() === 'verbose') {
              logger.detail(`Removed directory: ${item}`);
            }
          } else {
            fs.unlinkSync(itemPath);
            if (logger.getVerbosity() === 'verbose') {
              logger.detail(`Removed file: ${item}`);
            }
          }
        } catch (error) {
          logger.warn(
            `Failed to remove ${item}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }

    if (logger.getVerbosity() === 'verbose') {
      logger.detail(
        `Downloaded and extracted open.mp standard library to ${includesDirName}`
      );
    }
  } catch (error) {
    logger.error(
      `Failed to download open.mp standard library: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

export async function getLatestCompilerVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        'https://api.github.com/repos/openmultiplayer/compiler/releases/latest',
        {
          headers: {
            'User-Agent': 'tapi',
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
      if (logger.getVerbosity() === 'verbose') {
        logger.routine('Removing existing qawno directory');
      }
      fs.rmSync(qawnoDir, { recursive: true, force: true });
      if (logger.getVerbosity() === 'verbose') {
        logger.detail('Existing qawno directory removed');
      }
    }

    const installations = [];

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
    if (logger.getVerbosity() !== 'quiet') {
      logger.newline();
      logger.subheading('Compiler installation summary:');
      logger.keyValue('Result', installations.join(', '));
    }
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
    if (logger.getVerbosity() === 'verbose') {
      logger.detail(
        `Created ${targetDescription}include/ directory for standard library`
      );
    }
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
          if (logger.getVerbosity() === 'verbose') {
            logger.detail(`Preserved existing ${file} in ${targetDescription}`);
          }
          skippedFiles++;
          continue;
        }

        fs.copyFileSync(sourcePath, destPath);

        // Make executable on Unix systems
        if (process.platform !== 'win32' && file === 'pawncc') {
          fs.chmodSync(destPath, '755');
        }

        if (logger.getVerbosity() === 'verbose') {
          logger.detail(`Installed ${file} to ${targetDescription}`);
        }
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
            if (logger.getVerbosity() === 'verbose') {
              logger.detail(
                `Preserved existing library ${file} in ${targetDescription}`
              );
            }
            skippedFiles++;
            continue;
          }

          fs.copyFileSync(sourcePath, destPath);
          if (logger.getVerbosity() === 'verbose') {
            logger.detail(`Installed library ${file} to ${targetDescription}`);
          }
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
    if (logger.getVerbosity() === 'verbose') {
      logger.routine(
        `Installed ${copiedFiles} compiler files to ${targetDescription}`
      );
    }
  }
  if (skippedFiles > 0) {
    if (logger.getVerbosity() === 'verbose') {
      logger.routine(
        `Preserved ${skippedFiles} existing files in ${targetDescription}`
      );
    }
  }

  return copiedFiles;
}

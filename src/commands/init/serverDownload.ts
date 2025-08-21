import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as cliProgress from 'cli-progress';
import { logger } from '../../utils/logger';
import { createSpinner } from './utils';

export async function downloadopenmpServer(
  versionInput: string,
  directories: string[]
): Promise<void> {
  const spinner = createSpinner('Fetching latest open.mp version...');

  try {
    const version =
      versionInput === 'latest' ? await getLatestopenmpVersion() : versionInput;
    spinner.succeed(`Found open.mp version ${version}`);

    const platform = process.platform;
    let downloadUrl = '';
    let filename = '';

    if (platform === 'win32') {
      downloadUrl = `https://github.com/openmultiplayer/open.mp/releases/download/${version}/open.mp-win-x86.zip`;
      filename = 'open.mp-win-x86.zip';
    } else if (platform === 'linux') {
      downloadUrl = `https://github.com/openmultiplayer/open.mp/releases/download/${version}/open.mp-linux-x86.tar.gz`;
      filename = 'open.mp-linux-x86.tar.gz';
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    logger.routine(`Downloading from ${downloadUrl}`);
    await downloadFileWithProgress(downloadUrl, filename);

    const extractSpinner = createSpinner('Extracting server package...');
    await extractServerPackage(path.join(process.cwd(), filename), directories);
    extractSpinner.succeed('Server package extracted successfully');

    logger.success('Server installation complete!');
  } catch (error) {
    spinner.fail(
      `Failed to download server package: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    logger.info(
      'You can download the server package manually from https://github.com/openmultiplayer/open.mp/releases'
    );
    throw error;
  }
}

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
      .get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            logger.routine(
              `Following redirect to ${response.headers.location}`
            );

            req.destroy();

            const redirectReq = https
              .get(
                response.headers.location,
                { timeout: 10000 },
                (redirectResponse) => {
                  if (redirectResponse.headers['content-length']) {
                    totalBytes = parseInt(
                      redirectResponse.headers['content-length'],
                      10
                    );
                    progressBar.start(Math.floor(totalBytes / 1024), 0);
                  }

                  redirectResponse.pipe(file);

                  redirectResponse.on('data', (chunk) => {
                    receivedBytes += chunk.length;
                    if (totalBytes > 0) {
                      progressBar.update(Math.floor(receivedBytes / 1024));
                    }
                  });

                  file.on('finish', () => {
                    progressBar.stop();
                    file.close();
                    redirectReq.destroy();
                    logger.routine(`Server package downloaded to ${filename}`);
                    resolve();
                  });
                }
              )
              .on('error', (err) => {
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

          response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0) {
              progressBar.update(Math.floor(receivedBytes / 1024));
            }
          });

          file.on('finish', () => {
            progressBar.stop();
            file.close();
            req.destroy();
            logger.routine(`Server package downloaded to ${filename}`);
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
      .on('error', (err) => {
        progressBar.stop();
        file.close();
        req.destroy();
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}

export async function getLatestopenmpVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        'https://api.github.com/repos/openmultiplayer/open.mp/releases/latest',
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

export async function extractServerPackage(
  filePath: string,
  directories: string[]
): Promise<void> {
  try {
    const extractDir = path.join(process.cwd(), 'temp_extract');

    if (fs.existsSync(extractDir)) {
      try {
        logger.detail(`Removing existing extract directory at ${extractDir}`);
        fs.rmSync(extractDir, { recursive: true, force: true });
        logger.detail('Successfully removed existing extract directory');
      } catch (err) {
        logger.warn(
          `Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`
        );
        logger.warn('Proceeding anyway, cleanup may not be complete');
      }
    }

    logger.routine(`Creating temporary extract directory at ${extractDir}`);
    fs.mkdirSync(extractDir, { recursive: true });

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

    const dirContents = fs.readdirSync(extractDir);
    let serverDirName = null;

    for (const item of dirContents) {
      if (
        item.toLowerCase() === 'server' &&
        fs.statSync(path.join(extractDir, item)).isDirectory()
      ) {
        serverDirName = item;
        break;
      }
    }

    const copyProgress = createSpinner('Copying server files to project...');

    if (serverDirName) {
      const serverDir = path.join(extractDir, serverDirName);

      const files = fs.readdirSync(serverDir);
      let copiedFiles = 0;
      const totalFiles = files.length;

      for (const file of files) {
        const sourcePath = path.join(serverDir, file);
        const destPath = path.join(process.cwd(), file);

        copyProgress.text = `Copying server files: ${file} (${copiedFiles}/${totalFiles})`;

        if (
          fs.statSync(sourcePath).isDirectory() &&
          directories.includes(file)
        ) {
          const subFiles = fs.readdirSync(sourcePath);
          for (const subFile of subFiles) {
            const subSourcePath = path.join(sourcePath, subFile);
            const subDestPath = path.join(destPath, subFile);

            if (!fs.existsSync(subDestPath)) {
              try {
                if (fs.statSync(subSourcePath).isDirectory()) {
                  fs.cpSync(subSourcePath, subDestPath, { recursive: true });
                  logger.detail(`Copied directory: ${subFile} to ${file}/`);
                  copiedFiles++;
                } else {
                  fs.copyFileSync(subSourcePath, subDestPath);
                  logger.detail(`Copied file: ${subFile} to ${file}/`);
                  copiedFiles++;
                }
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(
                    `Could not copy ${subSourcePath}: ${err.message}`
                  );
                } else {
                  logger.warn(`Could not copy ${subSourcePath}: Unknown error`);
                }
              }
            }
          }
        } else if (!fs.existsSync(destPath)) {
          try {
            if (fs.statSync(sourcePath).isDirectory()) {
              fs.cpSync(sourcePath, destPath, { recursive: true });
              logger.detail(`Copied directory: ${file} to project root`);
              copiedFiles++;
            } else {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to project root`);
              copiedFiles++;
            }
          } catch (err) {
            if (err instanceof Error) {
              logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
            } else {
              logger.warn(`Could not copy ${sourcePath}: Unknown error`);
            }
          }
        }
      }

      copyProgress.succeed(`Copied ${copiedFiles} server files to project`);
    } else {
      copyProgress.warn(
        'No "Server" folder found in the package. Attempting to use extracted contents directly.'
      );

      const files = fs.readdirSync(extractDir);
      const totalFiles = files.length;
      let copiedFiles = 0;

      for (const file of files) {
        const sourcePath = path.join(extractDir, file);
        const destPath = path.join(process.cwd(), file);

        copyProgress.text = `Copying server files: ${file} (${copiedFiles}/${totalFiles})`;

        if (file.startsWith('.') || file === '__MACOSX') {
          continue;
        }

        if (
          fs.statSync(sourcePath).isDirectory() &&
          directories.includes(file)
        ) {
          const subFiles = fs.readdirSync(sourcePath);
          for (const subFile of subFiles) {
            const subSourcePath = path.join(sourcePath, subFile);
            const subDestPath = path.join(destPath, subFile);

            if (!fs.existsSync(subDestPath)) {
              try {
                if (fs.statSync(subSourcePath).isDirectory()) {
                  fs.cpSync(subSourcePath, subDestPath, { recursive: true });
                  logger.detail(`Copied directory: ${subFile} to ${file}/`);
                  copiedFiles++;
                } else {
                  fs.copyFileSync(subSourcePath, subDestPath);
                  logger.detail(`Copied file: ${subFile} to ${file}/`);
                  copiedFiles++;
                }
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(
                    `Could not copy ${subSourcePath}: ${err.message}`
                  );
                } else {
                  logger.warn(`Could not copy ${subSourcePath}: Unknown error`);
                }
              }
            }
          }
        } else if (!fs.existsSync(destPath)) {
          try {
            if (fs.statSync(sourcePath).isDirectory()) {
              fs.cpSync(sourcePath, destPath, { recursive: true });
              logger.detail(`Copied directory: ${file} to project root`);
              copiedFiles++;
            } else {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to project root`);
              copiedFiles++;
            }
          } catch (err) {
            if (err instanceof Error) {
              logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
            } else {
              logger.warn(`Could not copy ${sourcePath}: Unknown error`);
            }
          }
        }
      }

      copyProgress.succeed(`Copied ${copiedFiles} server files to project`);
    }

    const cleanupSpinner = createSpinner('Cleaning up downloaded files...');
    try {
      fs.unlinkSync(filePath);
      cleanupSpinner.succeed('Cleaned up downloaded package file');
    } catch (err) {
      if (err instanceof Error) {
        cleanupSpinner.fail(`Could not delete ${filePath}: ${err.message}`);
      } else {
        cleanupSpinner.fail(`Could not delete ${filePath}: Unknown error`);
      }
    }
  } catch (error) {
    logger.error(
      `Failed to extract server package: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      fs.unlinkSync(filePath);
    } catch {
      // silently ignore cleanup failure
    }
    throw error;
  }
}
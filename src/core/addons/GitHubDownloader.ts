import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';
import { logger } from '../../utils/logger';

/**
 * Handles downloading and extracting addons from GitHub repositories
 */
export class GitHubDownloader {
  /**
   * Download a GitHub repository and extract it to the target path.
   *
   * @param username - GitHub username.
   * @param repoName - Repository name.
   * @param targetPath - Path to extract the repository to.
   * @param branch - Branch to download (default: 'main').
   * @returns Promise that resolves when the download finishes.
   */
  async downloadRepo(
    username: string,
    repoName: string,
    targetPath: string,
    branch: string = 'main'
  ): Promise<void> {
    // Create target directory
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Download the repository as a ZIP file
    const zipUrl = `https://github.com/${username}/${repoName}/archive/refs/heads/${branch}.zip`;
    const zipPath = path.join(targetPath, 'repo.zip');

    logger.detail(`Downloading from: ${zipUrl}`);

    return new Promise((resolve, reject) => {
      const file = createWriteStream(zipPath);

      const downloadFile = (url: string) => {
        https
          .get(url, (response: import('http').IncomingMessage) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                logger.detail(`Following redirect to: ${redirectUrl}`);
                downloadFile(redirectUrl);
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject(
                new Error(
                  `Failed to download repository: ${response.statusCode}`
                )
              );
              return;
            }

            response.pipe(file);

            file.on('finish', async () => {
              file.close();

              try {
                await this.extractZip(zipPath, targetPath, repoName, branch);
                logger.detail(
                  `Successfully downloaded and extracted ${username}/${repoName}`
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            file.on('error', (error: Error) => {
              fs.unlinkSync(zipPath);
              reject(error);
            });
          })
          .on('error', (error: Error) => {
            reject(error);
          });
      };

      downloadFile(zipUrl);
    });
  }

  /**
   * Extract a ZIP file to the target directory.
   *
   * @param zipPath - Path to the ZIP file.
   * @param targetPath - Path to extract to.
   * @param repoName - Repository name (for folder name).
   * @param branch - Branch name (for folder name).
   * @returns Promise that resolves once extraction completes.
   */
  private async extractZip(
    zipPath: string,
    targetPath: string,
    repoName: string,
    branch: string
  ): Promise<void> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);

    // Extract to a temporary directory
    const tempDir = path.join(targetPath, 'temp');
    zip.extractAllTo(tempDir, true);

    // Find the extracted folder (it will be named repoName-branch)
    const extractedDir = path.join(tempDir, `${repoName}-${branch}`);
    if (fs.existsSync(extractedDir)) {
      // Move contents to target directory
      const files = fs.readdirSync(extractedDir);
      for (const file of files) {
        const srcPath = path.join(extractedDir, file);
        const destPath = path.join(targetPath, file);

        // Remove destination if it exists
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }

        fs.renameSync(srcPath, destPath);
      }

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
    } else {
      throw new Error('Failed to extract repository');
    }
  }

  /**
   * Download from a GitHub URL (supports branch/tag/commit).
   *
   * @param url - GitHub URL (e.g., user/repo@branch).
   * @param targetPath - Path to extract to.
   * @returns Promise that resolves when download is complete.
   */
  async downloadFromUrl(url: string, targetPath: string): Promise<void> {
    const match = url.match(/^([^/]+)\/([^@]+)(?:@(.+))?$/);
    if (!match) {
      throw new Error(`Invalid GitHub URL format: ${url}`);
    }

    const [, username, repoName, branch] = match;
    await this.downloadRepo(username, repoName, targetPath, branch || 'main');
  }
}

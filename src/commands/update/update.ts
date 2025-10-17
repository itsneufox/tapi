import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { logger } from '../../utils/logger';
import { confirm } from '@inquirer/prompts';
import { getVersion } from '../../utils/version';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  download_url: string;
  browser_download_url: string;
  size: number;
}

export default function (program: Command): void {
  program
    .command('update')
    .description('Check for and install tapi updates')
    .option('-c, --check', 'Only check for updates, do not install')
    .option('-f, --force', 'Force update even if already on latest version')
    .option('--pre', 'Include pre-release versions')
    .action(async (options) => {
      await handleUpdate(options);
    });
}

async function handleUpdate(options: { 
  check?: boolean; 
  force?: boolean; 
  pre?: boolean; 
}) {
  try {
    logger.info('Checking for tapi updates...');
    
    // Get current version
    const currentVersion = getCurrentVersion();
    logger.detail(`Current version: ${currentVersion}`);
    
    // Check for latest release
    const latestRelease = await getLatestRelease(options.pre);
    if (!latestRelease) {
      logger.error('Failed to check for updates');
      return;
    }
    
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');
    logger.detail(`Latest version: ${latestVersion}`);
    
    // Compare versions
    if (!options.force && !isNewerVersion(latestVersion, currentVersion)) {
      logger.info(`You are already on the latest version (${currentVersion})`);
      return;
    }
    
    // Show update information
    logger.info(`New version available: ${latestVersion}`);
    logger.info(`Release name: ${latestRelease.name}`);
    
    if (latestRelease.body) {
      logger.info('Changes:');
      logger.info(latestRelease.body.substring(0, 500) + (latestRelease.body.length > 500 ? '...' : ''));
    }
    
    // If only checking, stop here
    if (options.check) {
      logger.info('Use "tapi update" to install the update');
      return;
    }
    
    // Confirm update
    const shouldUpdate = await confirm({
      message: `Update to version ${latestVersion}?`,
      default: true
    });
    
    if (!shouldUpdate) {
      logger.info('Update cancelled');
      return;
    }
    
    // Download and install update
    await downloadAndInstallUpdate(latestRelease, currentVersion);
    
  } catch (error) {
    logger.error('Failed to update tapi');
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getCurrentVersion(): string {
  return getVersion();
}

async function getLatestRelease(includePre: boolean = false): Promise<GitHubRelease | null> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/itsneufox/tapi/releases',
      method: 'GET',
      headers: {
        'User-Agent': 'tapi-updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check for 404 (no releases)
          if (res.statusCode === 404) {
            reject(new Error('No releases found. This version of pawnctl may be pre-release or the repository has no published releases yet.'));
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
            return;
          }
          
          const releases: GitHubRelease[] = JSON.parse(data);
          
          // Filter releases
          const validReleases = releases.filter(release => {
            if (release.draft) return false;
            if (!includePre && release.prerelease) return false;
            return true;
          });
          
          // If no stable releases but there are pre-releases, suggest using --pre
          if (validReleases.length === 0) {
            const hasPreReleases = releases.some(r => !r.draft && r.prerelease);
            if (hasPreReleases) {
              reject(new Error('No stable releases found. Use "pawnctl update --pre" to include pre-release versions.'));
            } else {
              reject(new Error('No releases found in the repository.'));
            }
            return;
          }
          
          // Sort by published date (newest first)
          validReleases.sort((a, b) => 
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          );
          
          resolve(validReleases[0]);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function isNewerVersion(latest: string, current: string): boolean {
  // Simple version comparison (works for semver)
  const latestParts = latest.replace(/^v/, '').split(/[-.]/).map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? part : num;
  });
  
  const currentParts = current.replace(/^v/, '').split(/[-.]/).map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? part : num;
  });
  
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    
    if (typeof latestPart === 'number' && typeof currentPart === 'number') {
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    } else {
      const latestStr = String(latestPart);
      const currentStr = String(currentPart);
      if (latestStr > currentStr) return true;
      if (latestStr < currentStr) return false;
    }
  }
  
  return false;
}

async function downloadAndInstallUpdate(release: GitHubRelease, _currentVersion: string): Promise<void> {
  // Find the appropriate asset for current platform
  const platform = process.platform;
  let assetName: string;
  
  if (platform === 'win32') {
    assetName = 'tapi-setup-' + release.tag_name.replace(/^v/, '') + '.exe';
  } else if (platform === 'linux') {
    assetName = 'tapi-linux';
  } else if (platform === 'darwin') {
    assetName = 'tapi-macos';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  const asset = release.assets.find(a => a.name === assetName);
  if (!asset) {
    throw new Error(`No installer found for ${platform}`);
  }
  
  logger.info(`Downloading ${asset.name}...`);
  
  if (platform === 'win32') {
    // For Windows, download and run the installer
    await downloadWindowsInstaller(asset);
  } else {
    // For Unix platforms, replace the binary
    await downloadAndReplaceBinary(asset);
  }
}

async function downloadWindowsInstaller(asset: GitHubAsset): Promise<void> {
  const tempDir = require('os').tmpdir();
  const installerPath = path.join(tempDir, asset.name);
  
  // Download installer
  await downloadFile(asset.browser_download_url, installerPath);
  
  logger.info('Starting installer...');
  logger.info('The installer will now run. This terminal will close.');
  
  // Run the installer
  const { spawn } = require('child_process');
  spawn(installerPath, [], {
    detached: true,
    stdio: 'ignore'
  }).unref();
  
  // Exit current process
  process.exit(0);
}

async function downloadAndReplaceBinary(asset: GitHubAsset): Promise<void> {
  const executablePath = process.execPath;
  const backupPath = executablePath + '.backup';
  
  // Create backup
  logger.info('Creating backup...');
  fs.copyFileSync(executablePath, backupPath);
  
  try {
    // Download new binary to temp location
    const tempPath = executablePath + '.new';
    await downloadFile(asset.browser_download_url, tempPath);
    
    // Make executable
    fs.chmodSync(tempPath, '755');
    
    // Replace current binary
    logger.info('Installing update...');
    fs.renameSync(tempPath, executablePath);
    
    // Remove backup
    fs.unlinkSync(backupPath);
    
    logger.info('Update completed successfully!');
    logger.info('Please restart tapi to use the new version.');
    
  } catch (error) {
    // Restore backup on error
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, executablePath);
      fs.unlinkSync(backupPath);
    }
    throw error;
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(outputPath);
          downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlinkSync(outputPath);
        reject(error);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

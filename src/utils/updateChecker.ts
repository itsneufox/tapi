import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { logger } from './logger';

interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
}

interface UpdateCache {
  lastCheckDate: string; // YYYY-MM-DD format
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  currentVersion: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string;
}

const CACHE_FILE_PATH = path.join(os.homedir(), '.pawnctl', 'update-cache.json');

export async function checkForUpdates(silent: boolean = true): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  
  try {
    // Check cache first - if we have fresh daily check, use it
    const cachedResult = getCachedResult(currentVersion);
    if (cachedResult) {
      return cachedResult;
    }
    
    const latestRelease = await fetchLatestRelease();
    if (!latestRelease) {
      return { hasUpdate: false, currentVersion };
    }
    
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);
    
    const result = {
      hasUpdate,
      currentVersion,
      latestVersion: hasUpdate ? latestVersion : undefined,
      releaseUrl: hasUpdate ? latestRelease.html_url : undefined
    };
    
    // Cache the result for today
    cacheResult(result, latestVersion, latestRelease.html_url);
    
    return result;
  } catch (error) {
    if (!silent) {
      logger.error(`Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return { hasUpdate: false, currentVersion };
  }
}

export async function showUpdateNotification(): Promise<void> {
  // Check for updates (uses daily cache)
  const result = await checkForUpdates(true);
  
  if (result.hasUpdate && result.latestVersion) {
    logger.info('');
    logger.info(`📦 Update available: pawnctl ${result.latestVersion}`);
    logger.info('Run "pawnctl update" to upgrade');
    logger.info(`Release notes: ${result.releaseUrl}`);
    logger.info('');
  }
}

function getCurrentVersion(): string {
  // Try to get version from environment (set during build)
  const buildVersion = process.env.PAWNCTL_VERSION;
  if (buildVersion) {
    return buildVersion;
  }
  
  // Fallback for development/local builds
  return 'v1.0.0.100';
}


async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/itsneufox/pawnctl/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'pawnctl-updater',
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
          if (res.statusCode === 404) {
            // No releases found
            resolve(null);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
            return;
          }
          
          const release: GitHubRelease = JSON.parse(data);
          
          // Skip drafts and pre-releases for automatic checks
          if (release.draft || release.prerelease) {
            resolve(null);
            return;
          }
          
          resolve(release);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function isNewerVersion(latest: string, current: string): boolean {
  // Remove 'v' prefix and split version parts
  const latestParts = latest.replace(/^v/, '').split(/[-.]/).map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? part : num;
  });
  
  const currentParts = current.replace(/^v/, '').split(/[-.]/).map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? part : num;
  });
  
  // Compare version parts
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

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getCachedResult(currentVersion: string): UpdateCheckResult | null {
  try {
    if (!fs.existsSync(CACHE_FILE_PATH)) {
      return null;
    }
    
    const cacheData: UpdateCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
    
    // Check if cache is from today and for the same version
    if (cacheData.lastCheckDate === getTodayDate() && cacheData.currentVersion === currentVersion) {
      return {
        hasUpdate: cacheData.hasUpdate,
        currentVersion,
        latestVersion: cacheData.hasUpdate ? cacheData.latestVersion : undefined,
        releaseUrl: cacheData.hasUpdate ? cacheData.releaseUrl : undefined
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

function cacheResult(result: UpdateCheckResult, latestVersion: string, releaseUrl: string): void {
  try {
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheData: UpdateCache = {
      lastCheckDate: getTodayDate(),
      hasUpdate: result.hasUpdate,
      latestVersion,
      releaseUrl,
      currentVersion: result.currentVersion
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
  } catch {
    // Silently fail cache updates
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { logger } from './logger';

const CACHE_DIR = path.join(os.homedir(), '.tapi', 'cache');

/**
 * Get the cache directory path, creating it if it doesn't exist
 */
export function getCacheDir(): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return CACHE_DIR;
}

/**
 * Generate a cache key for a resource
 */
export function getCacheKey(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): string {
  // Sanitize for filesystem
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${sanitize(owner)}_${sanitize(repo)}_${sanitize(tag)}_${sanitize(assetName)}`;
}

/**
 * Get the cache path for a resource
 */
export function getCachePath(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): string {
  const cacheDir = getCacheDir();
  const cacheKey = getCacheKey(owner, repo, tag, assetName);
  return path.join(cacheDir, cacheKey);
}

/**
 * Check if a resource is cached
 */
export function isCached(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): boolean {
  const cachePath = getCachePath(owner, repo, tag, assetName);
  return fs.existsSync(cachePath);
}

/**
 * Get a cached resource path if it exists
 */
export function getFromCache(
  owner: string,
  repo: string,
  tag: string,
  assetName: string
): string | null {
  const cachePath = getCachePath(owner, repo, tag, assetName);
  if (fs.existsSync(cachePath)) {
    logger.routine(`Cache hit: ${assetName}`);
    return cachePath;
  }
  return null;
}

/**
 * Save a file to the cache
 */
export function saveToCache(
  owner: string,
  repo: string,
  tag: string,
  assetName: string,
  sourcePath: string
): string {
  const cachePath = getCachePath(owner, repo, tag, assetName);
  const cacheDir = path.dirname(cachePath);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Copy file to cache
  fs.copyFileSync(sourcePath, cachePath);
  logger.routine(`Cached: ${assetName}`);

  return cachePath;
}

/**
 * Copy a cached file to a destination
 */
export function copyFromCache(
  owner: string,
  repo: string,
  tag: string,
  assetName: string,
  destPath: string
): boolean {
  const cachePath = getFromCache(owner, repo, tag, assetName);
  if (cachePath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(cachePath, destPath);
    return true;
  }
  return false;
}

/**
 * Clear the entire cache
 */
export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    logger.info('Cache cleared');
  }
}

/**
 * Get cache size in bytes
 */
export function getCacheSize(): number {
  if (!fs.existsSync(CACHE_DIR)) {
    return 0;
  }

  let size = 0;
  const files = fs.readdirSync(CACHE_DIR);
  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      size += stat.size;
    }
  }
  return size;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

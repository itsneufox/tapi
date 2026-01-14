import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { logger } from './logger';

export interface ExtractOptions {
  /** Specific files/directories to extract (paths inside archive). If empty, extracts all. */
  paths?: string[];
  /** Whether to preserve directory structure or flatten */
  flatten?: boolean;
}

export interface ExtractedFile {
  /** Original path inside the archive */
  sourcePath: string;
  /** Destination path on disk */
  destPath: string;
}

/**
 * Detect archive type from filename or magic bytes
 */
export function getArchiveType(filePath: string): 'zip' | 'tar.gz' | 'unknown' {
  const ext = filePath.toLowerCase();
  if (ext.endsWith('.zip')) return 'zip';
  if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) return 'tar.gz';

  // Try magic bytes detection
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    // ZIP magic: PK (0x50 0x4B)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'zip';
    // GZIP magic: 0x1F 0x8B
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) return 'tar.gz';
  } catch {
    // Ignore read errors
  }

  return 'unknown';
}

/**
 * Extract a ZIP archive to a destination directory
 */
export function extractZip(
  archivePath: string,
  destDir: string,
  options: ExtractOptions = {}
): ExtractedFile[] {
  const zip = new AdmZip(archivePath);
  const entries = zip.getEntries();
  const extracted: ExtractedFile[] = [];

  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryPath = entry.entryName;

    // If specific paths requested, check if this entry matches
    if (options.paths && options.paths.length > 0) {
      const matches = options.paths.some((p) => {
        // Match exact path or path prefix (for directories)
        return (
          entryPath === p ||
          entryPath.startsWith(p + '/') ||
          entryPath.startsWith(p + '\\')
        );
      });
      if (!matches) continue;
    }

    let destPath: string;
    if (options.flatten) {
      destPath = path.join(destDir, path.basename(entryPath));
    } else {
      destPath = path.join(destDir, entryPath);
    }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Extract file
    fs.writeFileSync(destPath, entry.getData());

    extracted.push({
      sourcePath: entryPath,
      destPath: destPath,
    });

    logger.routine(`Extracted: ${entryPath}`);
  }

  return extracted;
}

/**
 * Extract a tar.gz archive to a destination directory
 */
export async function extractTarGz(
  archivePath: string,
  destDir: string,
  options: ExtractOptions = {}
): Promise<ExtractedFile[]> {
  fs.mkdirSync(destDir, { recursive: true });

  const extracted: ExtractedFile[] = [];

  // First, list all entries to filter
  const allEntries: string[] = [];
  await tar.list({
    file: archivePath,
    onentry: (entry) => {
      if (entry.type === 'File') {
        allEntries.push(entry.path);
      }
    },
  });

  // Filter entries if specific paths requested
  let entriesToExtract = allEntries;
  if (options.paths && options.paths.length > 0) {
    entriesToExtract = allEntries.filter((entryPath) => {
      return options.paths!.some((p) => {
        return (
          entryPath === p ||
          entryPath.startsWith(p + '/') ||
          entryPath.startsWith(p + '\\')
        );
      });
    });
  }

  if (entriesToExtract.length === 0) {
    return extracted;
  }

  // Extract with transform if flattening
  await tar.extract({
    file: archivePath,
    cwd: destDir,
    filter: (entryPath) => entriesToExtract.includes(entryPath),
    transform: options.flatten
      ? (entry) => {
          // Flatten by modifying the path
          const basename = path.basename(entry.path);
          entry.path = basename;
          return entry;
        }
      : undefined,
  });

  // Build extracted list
  for (const entryPath of entriesToExtract) {
    const destPath = options.flatten
      ? path.join(destDir, path.basename(entryPath))
      : path.join(destDir, entryPath);

    extracted.push({
      sourcePath: entryPath,
      destPath: destPath,
    });

    logger.routine(`Extracted: ${entryPath}`);
  }

  return extracted;
}

/**
 * Extract an archive (auto-detecting type) to a destination directory
 */
export async function extractArchive(
  archivePath: string,
  destDir: string,
  options: ExtractOptions = {}
): Promise<ExtractedFile[]> {
  const type = getArchiveType(archivePath);

  switch (type) {
    case 'zip':
      return extractZip(archivePath, destDir, options);
    case 'tar.gz':
      return await extractTarGz(archivePath, destDir, options);
    default:
      throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}

/**
 * Extract specific files from an archive and copy them to target locations
 */
export async function extractAndCopyFiles(
  archivePath: string,
  tempDir: string,
  fileMappings: Array<{ archivePath: string; destPath: string }>
): Promise<ExtractedFile[]> {
  const type = getArchiveType(archivePath);
  const extracted: ExtractedFile[] = [];

  fs.mkdirSync(tempDir, { recursive: true });

  if (type === 'zip') {
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    for (const mapping of fileMappings) {
      // Find matching entry (support glob-like matching)
      const entry = entries.find((e) => {
        const entryPath = e.entryName.replace(/\\/g, '/');
        const searchPath = mapping.archivePath.replace(/\\/g, '/');
        return entryPath === searchPath || entryPath.endsWith('/' + searchPath);
      });

      if (entry && !entry.isDirectory) {
        fs.mkdirSync(path.dirname(mapping.destPath), { recursive: true });
        fs.writeFileSync(mapping.destPath, entry.getData());

        extracted.push({
          sourcePath: entry.entryName,
          destPath: mapping.destPath,
        });

        logger.routine(`Extracted ${entry.entryName} -> ${mapping.destPath}`);
      }
    }
  } else if (type === 'tar.gz') {
    // Extract all to temp, then copy specific files
    await tar.extract({
      file: archivePath,
      cwd: tempDir,
    });

    for (const mapping of fileMappings) {
      // Find the file in extracted contents
      const searchPath = mapping.archivePath.replace(/\\/g, '/');
      const possiblePaths = [
        path.join(tempDir, searchPath),
        path.join(tempDir, path.basename(searchPath)),
      ];

      // Also search recursively for the file
      const foundPath =
        possiblePaths.find((p) => fs.existsSync(p)) ||
        findFileRecursive(tempDir, path.basename(searchPath));

      if (foundPath && fs.existsSync(foundPath)) {
        fs.mkdirSync(path.dirname(mapping.destPath), { recursive: true });
        fs.copyFileSync(foundPath, mapping.destPath);

        extracted.push({
          sourcePath: mapping.archivePath,
          destPath: mapping.destPath,
        });

        logger.routine(
          `Extracted ${mapping.archivePath} -> ${mapping.destPath}`
        );
      }
    }
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }

  return extracted;
}

/**
 * Recursively find a file by name in a directory
 */
function findFileRecursive(dir: string, filename: string): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return fullPath;
    }
  }

  return null;
}

/**
 * List contents of an archive without extracting
 */
export async function listArchiveContents(
  archivePath: string
): Promise<string[]> {
  const type = getArchiveType(archivePath);
  const contents: string[] = [];

  if (type === 'zip') {
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      contents.push(entry.entryName);
    }
  } else if (type === 'tar.gz') {
    await tar.list({
      file: archivePath,
      onentry: (entry) => {
        contents.push(entry.path);
      },
    });
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }

  return contents;
}

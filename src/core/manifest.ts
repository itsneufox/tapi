import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  entry: string;
  output: string;
  scripts?: Record<string, string>;
  compiler?: {
    input: string;
    output: string;
    includes: string[];
    constants: Record<string, string | number | boolean>;
    options: string[];
  };
}

/**
 * Generate a pawn.json manifest file based on the provided options
 */
export async function generatePackageManifest(options: {
  name: string;
  description?: string;
  author?: string;
  projectType?: 'gamemode' | 'filterscript' | 'library';
  addStdLib?: boolean;
}): Promise<void> {
  try {
    const manifest: PackageManifest = {
      name: options.name,
      version: '1.0.0',
      description: options.description || '',
      author: options.author || '',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      entry: `gamemodes/${options.name}.pwn`,
      output: `gamemodes/${options.name}.amx`,
      scripts: {
        build: 'pawnctl build',
        test: 'pawnctl test',
        run: 'pawnctl run',
      },
      compiler: {
        input: `gamemodes/${options.name}.pwn`,
        output: `gamemodes/${options.name}.amx`,
        includes: ['includes', 'gamemodes'],
        constants: {
          MAX_PLAYERS: 50,
          DEBUG: 1,
        },
        options: ['-d3', '-;+', '-(+', '-\\+', '-Z+'],
      },
    };

    if (options.addStdLib) {
      manifest.dependencies['pawn-lang/samp-stdlib'] = '^0.3.7';
    }

    // Set project-type specific paths if needed
    if (options.projectType === 'filterscript') {
      manifest.entry = `filterscripts/${options.name}.pwn`;
      manifest.output = `filterscripts/${options.name}.amx`;

      // Make sure compiler exists before accessing its properties
      if (manifest.compiler) {
        manifest.compiler.input = `filterscripts/${options.name}.pwn`;
        manifest.compiler.output = `filterscripts/${options.name}.amx`;
      }
    } else if (options.projectType === 'library') {
      manifest.entry = `includes/${options.name}.inc`;
      manifest.output = `includes/${options.name}.inc`; // Libraries don't typically have output

      // Make sure compiler exists before accessing its properties
      if (manifest.compiler) {
        manifest.compiler.input = `includes/${options.name}.inc`;
        manifest.compiler.output = '';
      }
    }

    const manifestPath = path.join(process.cwd(), 'pawn.json');
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    logger.info('Created pawn.json manifest file');
    logger.detail(`Manifest created at: ${manifestPath}`);
  } catch (error) {
    logger.error(
      `Failed to create manifest file: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error; // Re-throw to let the caller handle it
  }
}

/**
 * Load an existing manifest file
 */
export async function loadManifest(): Promise<PackageManifest | null> {
  try {
    const manifestPath = path.join(process.cwd(), 'pawn.json');
    if (!fs.existsSync(manifestPath)) {
      logger.warn('No pawn.json manifest found in the current directory');
      return null;
    }

    const data = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(data) as PackageManifest;
  } catch (error) {
    logger.error(
      `Failed to read manifest file: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return null;
  }
}

/**
 * Update an existing manifest file with new values
 */
export async function updateManifest(
  updates: Partial<PackageManifest>
): Promise<boolean> {
  try {
    const manifest = await loadManifest();
    if (!manifest) {
      return false;
    }

    // Merge the updates with the existing manifest
    const updatedManifest = { ...manifest, ...updates };

    // Handle nested compiler options if provided
    if (updates.compiler && manifest.compiler) {
      updatedManifest.compiler = { ...manifest.compiler, ...updates.compiler };
    } else if (updates.compiler) {
      updatedManifest.compiler = updates.compiler;
    }

    const manifestPath = path.join(process.cwd(), 'pawn.json');
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(updatedManifest, null, 2)
    );

    logger.info('Updated pawn.json manifest file');
    return true;
  } catch (error) {
    logger.error(
      `Failed to update manifest file: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return false;
  }
}

/**
 * Create a new manifest (alias for generatePackageManifest for backward compatibility)
 */
export async function createManifest(options: {
  name: string;
  description?: string;
  author?: string;
  projectType?: 'gamemode' | 'filterscript' | 'library';
  addStdLib?: boolean;
}): Promise<void> {
  return generatePackageManifest(options);
}

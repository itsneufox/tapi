import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Compiler overrides applied when selecting a named build profile.
 */
export interface BuildProfile {
  options?: string[];
  constants?: Record<string, string | number | boolean>;
  includes?: string[];
  input?: string;
  output?: string;
  description?: string;
}

/**
 * Structure of the tapi pawn.json manifest.
 */
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
  runtime?: 'samp' | 'openmp';
  legacy?: boolean;
  compiler?: {
    input: string;
    output: string;
    includes: string[];
    options: string[];
    profiles?: Record<string, BuildProfile>;
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
  legacySamp?: boolean;
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
        build: 'tapi build',
        start: 'tapi start',
        'build:start': 'tapi build && tapi start',
        install: 'tapi install',
        uninstall: 'tapi uninstall',
      },
      runtime: options.legacySamp ? 'samp' : 'openmp',
      legacy: options.legacySamp || false,
      compiler: {
        input: `gamemodes/${options.name}.pwn`,
        output: `gamemodes/${options.name}.amx`,
        includes: ['includes', 'gamemodes'],
        options: ['-d3', '-;+', '-(+', '-\\+', '-Z+'],
        profiles: {
          test: {
            description: 'Testing profile',
            options: ['-d3', '-;+', '-(+', '-\\+', '-Z+']
          }
        }
      },
    };

    if (options.addStdLib) {
      if (options.legacySamp) {
        manifest.dependencies['pawn-lang/samp-stdlib'] = '^0.3.7';
      } else {
        manifest.dependencies['pawn-lang/openmp-stdlib'] = '^0.3.7';
      }
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

    const tapiDir = path.join(process.cwd(), '.tapi');
    if (!fs.existsSync(tapiDir)) {
      fs.mkdirSync(tapiDir, { recursive: true });
    }
    const manifestPath = path.join(tapiDir, 'pawn.json');
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    logger.success('Created pawn.json manifest file');
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
    const tapiDir = path.join(process.cwd(), '.tapi');
    if (!fs.existsSync(tapiDir)) {
      fs.mkdirSync(tapiDir, { recursive: true });
    }
    const manifestPath = path.join(tapiDir, 'pawn.json');
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

    const tapiDir = path.join(process.cwd(), '.tapi');
    if (!fs.existsSync(tapiDir)) {
      fs.mkdirSync(tapiDir, { recursive: true });
    }
    const manifestPath = path.join(tapiDir, 'pawn.json');
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(updatedManifest, null, 2)
    );

    logger.success('Updated pawn.json manifest file');
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

import * as fs from 'fs';
import * as path from 'path';

let cachedVersion: string | null = null;

/**
 * Get the current version of pawnctl
 * Priority:
 * 1. PAWNCTL_VERSION environment variable (set by CI/build)
 * 2. __BUILD_VERSION__ placeholder (replaced during build)
 * 3. package.json version (development fallback)
 */
export function getVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  // 1. Check if version was set by CI/build process
  if (process.env.PAWNCTL_VERSION) {
    cachedVersion = process.env.PAWNCTL_VERSION;
    return cachedVersion;
  }

  // 2. This will be replaced by build script with actual version
  cachedVersion = '__BUILD_VERSION__';

  // 3. Fallback for development (when placeholder not replaced)
  if (cachedVersion === '__BUILD_VERSION__') {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (packageJson.version) {
          cachedVersion = packageJson.version;
          return cachedVersion!;
        }
      }
    } catch {
      // Continue to fallback
    }
    cachedVersion = 'dev-build';
  }

  return cachedVersion;
}

/**
 * Clear the cached version (useful for testing)
 */
export function clearVersionCache(): void {
  cachedVersion = null;
}

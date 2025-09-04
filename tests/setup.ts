import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../src/utils/logger';

// Global test setup
let tempDirs: string[] = [];

/**
 * Create a temporary directory for tests
 */
export function createTempDir(prefix: string = 'pawnctl-test-'): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

/**
 * Clean up temporary directories after tests
 */
export function cleanupTempDirs(): void {
  tempDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      try {
        // On Windows, sometimes files are still locked, retry a few times
        let retries = 3;
        while (retries > 0) {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
            break;
          } catch (error) {
            retries--;
            if (retries === 0) throw error;
            // Wait a bit before retrying
            const waitMs = 100;
            const start = Date.now();
            while (Date.now() - start < waitMs) {
              // Busy wait
            }
          }
        }
      } catch {
        // Silently ignore cleanup failures in tests (Windows file locking)
        // console.warn(`Failed to cleanup test directory ${dir}: ${error}`);
      }
    }
  });
  tempDirs = [];
}

// Set logger to quiet mode for tests
beforeAll(() => {
  logger.setVerbosity('quiet');
});

// Clean up after each test
afterEach(() => {
  cleanupTempDirs();
});

// Extend Jest matchers using global namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidJSON(): R;
      toExistAsFile(): R;
      toExistAsDirectory(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidJSON(received: string) {
    try {
      JSON.parse(received);
      return {
        message: () => `Expected ${received} not to be valid JSON`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `Expected ${received} to be valid JSON, but got: ${error}`,
        pass: false,
      };
    }
  },

  toExistAsFile(received: string) {
    const pass = fs.existsSync(received) && fs.statSync(received).isFile();
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to exist as a file`
          : `Expected ${received} to exist as a file`,
      pass,
    };
  },

  toExistAsDirectory(received: string) {
    const pass = fs.existsSync(received) && fs.statSync(received).isDirectory();
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to exist as a directory`
          : `Expected ${received} to exist as a directory`,
      pass,
    };
  },
});
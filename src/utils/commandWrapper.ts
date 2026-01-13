import { logger } from './logger';

/**
 * Wraps command execution with standardized error handling
 * @param action - Description of the action being performed (e.g., "install package")
 * @param fn - Async function to execute
 * @returns Promise that resolves with the function result or exits on error
 */
export async function withErrorHandling<T>(
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(
      `Failed to ${action}: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exit(1);
  }
}

/**
 * Wraps command execution with error handling and optional cleanup
 * @param action - Description of the action being performed
 * @param fn - Async function to execute
 * @param cleanup - Optional cleanup function to run on error
 * @returns Promise that resolves with the function result or exits on error
 */
export async function withErrorHandlingAndCleanup<T>(
  action: string,
  fn: () => Promise<T>,
  cleanup?: () => Promise<void>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        logger.detail(
          `Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`
        );
      }
    }
    logger.error(
      `Failed to ${action}: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exit(1);
  }
}

import { Command } from 'commander';
import { exec } from 'child_process';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { clearServerState } from '../../utils/serverState';

/**
 * Register the emergency `kill` command that force-terminates running server processes.
 *
 * @param program - Commander instance to extend.
 */
export default function (program: Command): void {
  program
    .command('kill')
    .description('Force kill any running SA-MP/open.mp server processes (emergency cleanup)')
    .option('-f, --force', 'skip confirmation prompt')
    .action(async (options) => {
      showBanner(false);

      try {
        if (!options.force) {
          logger.warn('This will forcefully terminate ALL SA-MP/open.mp server processes.');
          logger.info('For normal server shutdown, use Ctrl+C in the terminal running "tapi start"');
          logger.newline();
          
          // Simple confirmation without inquirer dependency
          process.stdout.write('Continue? (y/N): ');
          const response = await new Promise<string>((resolve) => {
            process.stdin.once('data', (data) => {
              resolve(data.toString().trim());
            });
          });
          
          if (response.toLowerCase() !== 'y' && response.toLowerCase() !== 'yes') {
            logger.info('Operation cancelled');
            return;
          }
        }

        logger.heading('Force killing server processes...');

        const platform = process.platform;
        let killed = false;

        if (platform === 'win32') {
          // Kill common server executables on Windows
          const processNames = ['omp-server.exe', 'samp-server.exe', 'samp03svr.exe'];
          
          for (const processName of processNames) {
            try {
              await new Promise<void>((resolve, reject) => {
                exec(`taskkill /F /IM "${processName}" /T`, (error, stdout, stderr) => {
                  if (error && !error.message.includes('not found') && !stderr.includes('not found')) {
                    reject(error);
                  } else {
                    if (stdout && !stdout.includes('not found')) {
                      logger.success(`Killed ${processName}`);
                      killed = true;
                    }
                    resolve();
                  }
                });
              });
            } catch (error) {
              logger.warn(`Could not kill ${processName}: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
          }
        } else {
          // Kill server processes on Unix-like systems
          const processPatterns = ['omp-server', 'samp-server', 'samp03svr'];
          
          for (const pattern of processPatterns) {
            try {
              await new Promise<void>((resolve, reject) => {
                exec(`pkill -f "${pattern}"`, (error, _stdout, _stderr) => {
                  if (error && error.code !== 1) { // code 1 means no processes found
                    reject(error);
                  } else {
                    if (error?.code !== 1) {
                      logger.success(`Killed processes matching ${pattern}`);
                      killed = true;
                    }
                    resolve();
                  }
                });
              });
            } catch (error) {
              logger.warn(`Could not kill ${pattern}: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
          }
        }

        // Clear any stored server state
        clearServerState();
        
        if (killed) {
          logger.newline();
          logger.finalSuccess('Server processes terminated and state cleared');
        } else {
          logger.info('No server processes found running');
        }

      } catch (error) {
        logger.error(
          `Kill operation failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

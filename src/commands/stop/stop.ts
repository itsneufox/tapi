import { Command } from 'commander';
import { exec } from 'child_process';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import {
  loadServerState,
  clearServerState,
  isServerRunning,
} from '../../utils/serverState';
import * as fs from 'fs';
import * as path from 'path';

export default function (program: Command): void {
  program
    .command('stop')
    .description('Stop the running open.mp server')
    .option('-f, --force', 'force stop the server')
    .action(async (options) => {
      showBanner(false);

      try {
        if (!isServerRunning()) {
          logger.info('No server is currently running.');
          return;
        }

        const state = loadServerState();
        logger.heading('Stopping open.mp server...');

        if (state.pid) {
          // We have a PID, use it to stop the process
          try {
            if (process.platform === 'win32') {
              if (options.force) {
                exec(`taskkill /F /PID ${state.pid} /T`);
              } else {
                exec(`taskkill /PID ${state.pid} /T`);
              }
            } else {
              if (options.force) {
                exec(`kill -9 ${state.pid}`);
              } else {
                exec(`kill ${state.pid}`);
              }
            }

            logger.success('Stop signal sent to server');

            // Wait a moment and check if process is still running
            setTimeout(() => {
              try {
                if (state.pid) {
                  const pid = state.pid;
                  if (process.platform === 'win32') {
                    exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout) => {
                      if (stdout.includes(pid.toString())) {
                        logger.warn(
                          'Server is still running. Use --force to kill it.'
                        );
                      } else {
                        logger.success('Server stopped successfully');
                      }
                      clearServerState();
                    });
                  } else {
                    exec(`ps -p ${pid}`, (error, stdout) => {
                      if (stdout.includes(pid.toString())) {
                        logger.warn(
                          'Server is still running. Use --force to kill it.'
                        );
                      } else {
                        logger.success('Server stopped successfully');
                      }
                      clearServerState();
                    });
                  }
                } else {
                  logger.success('Server stopped successfully');
                  clearServerState();
                }
              } catch {
                logger.success('Server stopped successfully');
                clearServerState();
              }
            }, 1000);
          } catch (error) {
            logger.error(
              `Failed to stop server: ${error instanceof Error ? error.message : 'unknown error'}`
            );
            process.exit(1);
          }
        } else if (state.windowMode && state.serverPath) {
          // Window mode without PID - try to kill by process name
          try {
            const processName = path.basename(state.serverPath || '');
            if (process.platform === 'win32') {
              if (options.force) {
                exec(`taskkill /F /IM "${processName}" /T`);
              } else {
                exec(`taskkill /IM "${processName}" /T`);
              }
            } else {
              if (options.force) {
                exec(`pkill -9 -f "${processName}"`);
              } else {
                exec(`pkill -f "${processName}"`);
              }
            }

            logger.success('Stop signal sent to server');

            // Wait a moment and check if process is still running
            setTimeout(() => {
              try {
                const processName = path.basename(state.serverPath || '');
                if (process.platform === 'win32') {
                  exec(`tasklist /FI "IMAGENAME eq ${processName}"`, (error, stdout) => {
                    if (stdout.includes(processName)) {
                      logger.warn(
                        'Server is still running. Use --force to kill it.'
                      );
                    } else {
                      logger.success('Server stopped successfully');
                    }
                    clearServerState();
                  });
                } else {
                  exec(`pgrep -f "${processName}"`, (error, stdout) => {
                    if (stdout.trim()) {
                      logger.warn(
                        'Server is still running. Use --force to kill it.'
                      );
                    } else {
                      logger.success('Server stopped successfully');
                    }
                    clearServerState();
                  });
                }
              } catch {
                logger.success('Server stopped successfully');
                clearServerState();
              }
            }, 1000);
          } catch (error) {
            logger.error(
              `Failed to stop server: ${error instanceof Error ? error.message : 'unknown error'}`
            );
            process.exit(1);
          }
        } else {
          logger.warn('Server PID not found, clearing state');
          clearServerState();
        }

        // Clean up temp files
        if (state.tempFiles) {
          for (const file of state.tempFiles) {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          }
        }
      } catch (error) {
        logger.error(
          `Failed to stop server: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

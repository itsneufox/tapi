import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { logger } from '../../utils/logger';
import * as os from 'os';
import { showBanner } from '../../utils/banner';
import {
  loadServerState,
  saveServerState,
  clearServerState,
  isServerRunning,
} from '../../utils/serverState';

export default function (program: Command): void {
  program
    .command('start')
    .description('Start the open.mp server')
    .option(
      '-c, --config <file>',
      'specify a custom config file',
      'config.json'
    )
    .option('-d, --debug', 'start with debug output')
    .option('-e, --existing', 'connect to existing server if running')
    .option('-w, --window', 'force start in a new window instead of terminal')
    .option('-v, --verbose', 'show detailed debug output')
    .option('--log-to-file [path]', 'save logs to file (optional custom path)')
    .action(async (options) => {
      // Handle logging setup FIRST, before any other output
      if (options.logToFile) {
        const logPath =
          typeof options.logToFile === 'string' ? options.logToFile : undefined;
        logger.enableFileLogging(logPath);
      }

      // Handle verbosity
      if (options.verbose) {
        logger.setVerbosity('verbose');
      }

      showBanner(false);

      try {
        if (isServerRunning()) {
          if (options.existing) {
            logger.success('Connected to existing server instance');
            return;
          }
          logger.error(
            'Server is already running. Use Ctrl+C to stop it first.'
          );
          logger.info(
            'Or use --existing flag to connect to the running server'
          );
          process.exit(1);
        }

        logger.heading('Starting open.mp server...');

        const serverExe = path.join(process.cwd(), 'omp-server.exe');
        const serverExeLinux = path.join(process.cwd(), 'omp-server');

        if (!fs.existsSync(serverExe) && !fs.existsSync(serverExeLinux)) {
          logger.error(
            'Server executable not found. Make sure you are in the correct directory.'
          );
          logger.newline();
          logger.subheading('Expected server files:');
          logger.list(['omp-server.exe (Windows)', 'omp-server (Linux/macOS)']);
          logger.newline();
          logger.info(
            'Run "pawnctl init" to set up a new project with server files'
          );
          process.exit(1);
        }

        const serverExecutable = fs.existsSync(serverExe)
          ? serverExe
          : serverExeLinux;

        const args: string[] = [];

        if (options.config && options.config !== 'config.json') {
          args.push(`--config=${options.config}`);
        }

        if (options.debug) {
          args.push('--debug');
        }

        logger.routine(`Working directory: ${process.cwd()}`);
        logger.routine(`Server executable: ${path.basename(serverExecutable)}`);

        if (args.length > 0) {
          logger.routine(`Arguments: ${args.join(' ')}`);
        }

        const editorPreferencePath = path.join(
          os.homedir(),
          '.pawnctl',
          'preferences.json'
        );
        let isVSCodeUser = false;

        try {
          if (fs.existsSync(editorPreferencePath)) {
            const preferences = JSON.parse(
              fs.readFileSync(editorPreferencePath, 'utf8')
            );
            isVSCodeUser = preferences.editor === 'VS Code';
          }
        } catch (error) {
          logger.detail(
            `Could not read editor preferences: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }

        if (isVSCodeUser && !options.window) {
          logger.newline();
          logger.info('Starting server in the current terminal...');
          logger.info('Press Ctrl+C to stop the server.');
          logger.newline();

          const serverProcess = spawn(serverExecutable, args, {
            stdio: 'inherit',
            detached: false,
            shell: process.platform === 'win32',
          });

          saveServerState({
            pid: serverProcess.pid,
            serverPath: serverExecutable,
          });

          process.on('SIGINT', () => {
            logger.newline();
            logger.working('Received Ctrl+C, stopping server');

            if (serverProcess.pid) {
              try {
                if (process.platform === 'win32') {
                  exec(`taskkill /F /PID ${serverProcess.pid} /T`);
                } else {
                  serverProcess.kill('SIGINT');
                }
              } catch (error) {
                logger.warn(
                  `Error stopping process: ${error instanceof Error ? error.message : 'unknown error'}`
                );
              }
            }

            clearServerState();

            setTimeout(() => {
              logger.success('Server stopped successfully');
              process.exit(0);
            }, 500);
          });

          serverProcess.on('exit', (code) => {
            logger.newline();
            if (code === 0) {
              logger.success(`Server exited successfully`);
            } else {
              logger.warn(`Server exited with code ${code || 0}`);
            }
            clearServerState();
            process.exit(code || 0);
          });

          return;
        }

        // Starting in a new window
        logger.working('Launching server in a new window');

        if (process.platform === 'win32') {
          const batchFile = path.join(
            os.tmpdir(),
            `pawnctl-server-${Date.now()}.bat`
          );
          const batchContent = `@echo off
cd /d "${process.cwd()}"
start "open.mp Server" /min "${serverExecutable}" ${args.join(' ')}
`;
          fs.writeFileSync(batchFile, batchContent);

          const child = exec(`"${batchFile}"`, (error) => {
            if (error) {
              logger.error(`Failed to start server: ${error.message}`);
              clearServerState();
              if (fs.existsSync(batchFile)) {
                fs.unlinkSync(batchFile);
              }
              process.exit(1);
            }
          });

          saveServerState({
            pid: child.pid,
            serverPath: serverExecutable,
            tempFiles: [batchFile],
          });

          logger.newline();
          logger.finalSuccess('Server started in a new window');
          logger.info('Check your taskbar for the server window');
        } else {
          let terminalCommand = '';

          if (process.env.TERM_PROGRAM === 'iTerm.app') {
            terminalCommand = `osascript -e 'tell application "iTerm" to create window with default profile command "${serverExecutable} ${args.join(' ')}"'`;
          } else if (fs.existsSync('/usr/bin/gnome-terminal')) {
            terminalCommand = `gnome-terminal -- ${serverExecutable} ${args.join(' ')}`;
          } else if (fs.existsSync('/usr/bin/xterm')) {
            terminalCommand = `xterm -e "${serverExecutable} ${args.join(' ')}"`;
          } else {
            logger.error(
              'Could not find a suitable terminal emulator. Please start the server manually.'
            );
            logger.newline();
            logger.subheading('Manual start command:');
            logger.command(`${serverExecutable} ${args.join(' ')}`);
            process.exit(1);
          }

          const child = exec(terminalCommand, (error) => {
            if (error) {
              logger.error(`Failed to start server: ${error.message}`);
              clearServerState();
              process.exit(1);
            }
          });

          saveServerState({
            pid: child.pid,
            serverPath: serverExecutable,
          });

          logger.newline();
          logger.finalSuccess('Server started in a new terminal window');
        }

        process.on('SIGINT', () => {
          logger.working('Received Ctrl+C, cleaning up');

          const state = loadServerState();

          if (state.tempFiles) {
            for (const file of state.tempFiles) {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            }
          }

          clearServerState();
          logger.success('Cleanup complete');
          process.exit(0);
        });
      } catch (error) {
        logger.error(
          `Failed to start server: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

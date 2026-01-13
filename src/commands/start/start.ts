import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger';
import * as os from 'os';
import { showBanner } from '../../utils/banner';
import * as chokidar from 'chokidar';
import {
  loadServerState,
  saveServerState,
  clearServerState,
  isServerRunning,
} from '../../utils/serverState';

// ANSI color codes for terminal formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Pretty-print server console output with colorized formatting.
 *
 * @param output - Raw server stdout/stderr chunk.
 * @param isError - Whether the chunk originated from stderr.
 */
function formatServerOutput(output: string, isError = false): void {
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Component loading messages
    if (line.includes('Loading component')) {
      const componentName = line.match(/Loading component (.+?)\.dll/)?.[1] || 'Unknown';
      console.log(`${colors.blue}->${colors.reset} Loading ${colors.cyan}${componentName}${colors.reset} component...`);
      continue;
    }
    
    // Successful component loads
    if (line.includes('Successfully loaded component')) {
      const match = line.match(/Successfully loaded component (.+?) \((.+?)\)/);
      if (match) {
        const [, componentName, version] = match;
        console.log(`${colors.green}OK${colors.reset} ${colors.cyan}${componentName}${colors.reset} ${colors.gray}(${version})${colors.reset}`);
      }
      continue;
    }
    
    // Server version and startup info
    if (line.includes('Starting open.mp server')) {
      const versionMatch = line.match(/Starting open.mp server \((.+?)\)/);
      if (versionMatch) {
        console.log(`${colors.green}${colors.bright}-> open.mp server ${versionMatch[1]}${colors.reset}`);
      }
      continue;
    }
    
    // Component count summary
    if (line.includes('Loaded') && line.includes('component(s)')) {
      const match = line.match(/Loaded (\d+) component\(s\)/);
      if (match) {
        console.log(`${colors.green}OK${colors.reset} Loaded ${colors.bright}${match[1]}${colors.reset} components`);
      }
      continue;
    }
    
    // Timestamped log messages
    if (line.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      const logMatch = line.match(/\[(.+?)\] \[(.+?)\] (.+)/);
      if (logMatch) {
        const [, timestamp, level, message] = logMatch;
        const time = new Date(timestamp).toLocaleTimeString();
        
        let levelColor = colors.white;
        let levelIcon = '-';
        
        switch (level.toLowerCase()) {
          case 'info':
            levelColor = colors.blue;
            levelIcon = 'INFO';
            break;
          case 'warning':
          case 'warn':
            levelColor = colors.yellow;
            levelIcon = 'WARN';
            break;
          case 'error':
            levelColor = colors.red;
            levelIcon = 'ERROR';
            break;
          case 'debug':
            levelColor = colors.gray;
            levelIcon = 'DEBUG';
            break;
        }
        
        console.log(`${colors.gray}[${time}]${colors.reset} ${levelColor}${levelIcon}${colors.reset} ${message}`);
      }
      continue;
    }
    
    // Network startup messages
    if (line.includes('Legacy Network started on port')) {
      const portMatch = line.match(/port (\d+)/);
      if (portMatch) {
        console.log(`${colors.green}OK${colors.reset} Server listening on port ${colors.bright}${portMatch[1]}${colors.reset}`);
      }
      continue;
    }
    
    // Warning about announcements
    if (line.includes("Couldn't announce")) {
      const logMatch = line.match(/\[(.+?)\] \[(.+?)\] (.+)/);
      if (logMatch) {
        const [, timestamp, _level, message] = logMatch;
        const time = new Date(timestamp).toLocaleTimeString();
        console.log(`${colors.gray}[${time}]${colors.reset} ${colors.yellow}WARN${colors.reset} ${message}`);
      }
      continue;
    }
    
    // Status and Message details for announcement warnings (with tabs)
    if (line.includes('Status:') || line.includes('Message:')) {
      const logMatch = line.match(/\[(.+?)\] \[(.+?)\]\s*(.+)/);
      if (logMatch) {
        const [, timestamp, _level, message] = logMatch;
        const time = new Date(timestamp).toLocaleTimeString();
        console.log(`${colors.gray}[${time}]${colors.reset} ${colors.yellow}WARN${colors.reset} ${message.replace(/^\s+/, '')}`);
      }
      continue;
    }
    
    // Error output
    if (isError) {
      console.error(`${colors.red}ERROR${colors.reset} ${line}`);
      continue;
    }
    
    // Default: print line as-is but trimmed
    if (line.trim()) {
      console.log(line);
    }
  }
}

interface OpenMPConfig {
  hostname?: string;
  port?: number;
  rcon_password?: string;
  pawn?: {
    main_scripts?: string[];
  };
  [key: string]: unknown;
}

interface SAMPConfig {
  hostname?: string;
  port?: number;
  rcon_password?: string;
  gamemode0?: string;
  [key: string]: unknown;
}

interface ServerInfo {
  type: 'openmp' | 'samp';
  executable: string;
  configFile: string;
  config: OpenMPConfig | SAMPConfig;
}

/**
 * Inspect the working directory and infer whether an open.mp or SA-MP server exists.
 */
function detectServerType(): ServerInfo | null {
  const currentDir = process.cwd();
  
  // Check for open.mp server
  const ompServerExe = path.join(currentDir, 'omp-server.exe');
  const ompServerLinux = path.join(currentDir, 'omp-server');
  const ompConfig = path.join(currentDir, 'config.json');
  
  if ((fs.existsSync(ompServerExe) || fs.existsSync(ompServerLinux)) && fs.existsSync(ompConfig)) {
    try {
      const config = JSON.parse(fs.readFileSync(ompConfig, 'utf8'));
      return {
        type: 'openmp',
        executable: fs.existsSync(ompServerExe) ? ompServerExe : ompServerLinux,
        configFile: ompConfig,
        config
      };
    } catch (error) {
      logger.warn(`Found open.mp server but could not parse config.json: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  
  // Check for SA-MP server
  const sampServerExe = path.join(currentDir, 'samp-server.exe');
  const sampServerLinux = path.join(currentDir, 'samp03svr');
  const sampConfig = path.join(currentDir, 'server.cfg');
  
  if ((fs.existsSync(sampServerExe) || fs.existsSync(sampServerLinux)) && fs.existsSync(sampConfig)) {
    try {
      const config = parseSampConfig(sampConfig);
      return {
        type: 'samp',
        executable: fs.existsSync(sampServerExe) ? sampServerExe : sampServerLinux,
        configFile: sampConfig,
        config
      };
    } catch (error) {
      logger.warn(`Found SA-MP server but could not parse server.cfg: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  
  return null;
}

/**
 * Parse traditional server.cfg key/value pairs into an object map.
 */
function parseSampConfig(configPath: string): SAMPConfig {
  const configContent = fs.readFileSync(configPath, 'utf8');
  const config: SAMPConfig = {};
  
  for (const line of configContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex > 0) {
        const key = trimmed.substring(0, spaceIndex);
        const value = trimmed.substring(spaceIndex + 1);
        config[key] = value;
      }
    }
  }
  
  return config;
}

/**
 * Validate server configuration for common misconfigurations and missing files.
 */
function validateServerConfig(serverInfo: ServerInfo): string[] {
  const issues: string[] = [];
  
  if (serverInfo.type === 'openmp') {
    // Validate open.mp config
    const config = serverInfo.config as OpenMPConfig;
    
    if (!config.pawn?.main_scripts?.length) {
      issues.push('No gamemodes specified in config.json (pawn.main_scripts)');
    }
    
    if (!config.rcon_password || config.rcon_password === 'changeme') {
      issues.push('RCON password not set or using default value');
    }
    
    // Check if gamemode files exist
    if (config.pawn?.main_scripts) {
      for (const script of config.pawn.main_scripts) {
        // Extract just the gamemode name (before any parameters)
        const gamemodeName = script.split(' ')[0];
        const scriptPath = path.join(process.cwd(), 'gamemodes', `${gamemodeName}.amx`);
        if (!fs.existsSync(scriptPath)) {
          issues.push(`Gamemode file not found: gamemodes/${gamemodeName}.amx`);
        }
      }
    }
  } else {
    // Validate SA-MP config
    const config = serverInfo.config as SAMPConfig;
    
    if (!config.gamemode0) {
      issues.push('No gamemode specified in server.cfg (gamemode0)');
    }
    
    if (!config.rcon_password || config.rcon_password === 'changeme') {
      issues.push('RCON password not set or using default value');
    }
    
    // Check if gamemode file exists
    if (config.gamemode0) {
      const gamemodeName = (config.gamemode0 as string).split(' ')[0];
      const scriptPath = path.join(process.cwd(), 'gamemodes', `${gamemodeName}.amx`);
      if (!fs.existsSync(scriptPath)) {
        issues.push(`Gamemode file not found: gamemodes/${gamemodeName}.amx`);
      }
    }
  }
  
  return issues;
}

interface StartOptions {
  config?: string;
  debug?: boolean;
  existing?: boolean;
  window?: boolean;
  watch?: boolean;
}

/**
 * Launch watch mode: rebuild and restart the server when source files change.
 */
async function startWatchMode(serverInfo: ServerInfo, _options: StartOptions): Promise<void> {
  logger.heading('Starting watch mode...');
  logger.info('Press Ctrl+C to stop watching and exit');
  logger.newline();

  let serverProcess: ChildProcess | null = null;
  let isRestarting = false;

  // Function to start/restart the server
  const startServer = async (): Promise<void> => {
    if (isRestarting) return;
    isRestarting = true;

    // Kill existing server if running
    if (serverProcess && !serverProcess.killed) {
      logger.info('Stopping server...');
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for graceful shutdown
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }

    try {
      // Build first
      logger.info('Building project...');
      const buildResult = await new Promise<{ success: boolean, output: string }>((resolve) => {
        const buildProcess = spawn('tapi', ['build'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd()
        });

        let output = '';
        buildProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });
        buildProcess.stderr?.on('data', (data) => {
          output += data.toString();
        });

        buildProcess.on('close', (code) => {
          resolve({ success: code === 0, output });
        });
      });

      if (!buildResult.success) {
        logger.error('Build failed, not restarting server');
        logger.info(buildResult.output);
        isRestarting = false;
        return;
      }

      logger.success('Build successful');

      // Start server
      logger.info('Starting server...');
      serverProcess = spawn(serverInfo.executable, [], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        formatServerOutput(data.toString());
      });

      serverProcess.stderr?.on('data', (data) => {
        formatServerOutput(data.toString(), true);
      });

      serverProcess.on('close', (code) => {
        if (!isRestarting) {
          logger.info(`Server exited with code ${code}`);
        }
      });

      logger.success('Server started in watch mode');
    } catch (error) {
      logger.error(`Failed to start server: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    isRestarting = false;
  };

  // Watch for file changes
  const watcher = chokidar.watch([
    'gamemodes/**/*.pwn',
    'filterscripts/**/*.pwn',
    'includes/**/*.inc',
    '*.inc',
    '*.pwn'
  ], {
    ignored: /node_modules|\.git/,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async (path) => {
    logger.info(`File changed: ${path}`);
    await startServer();
  });

  watcher.on('add', async (path) => {
    logger.info(`File added: ${path}`);
    await startServer();
  });

  watcher.on('unlink', async (path) => {
    logger.info(`File deleted: ${path}`);
    await startServer();
  });

  // Initial server start
  await startServer();

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    logger.newline();
    logger.info('Stopping watch mode...');
    
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 2000);
    }
    
    watcher.close();
    clearServerState();
    logger.success('Watch mode stopped');
    process.exit(0);
  });

  // Keep the process alive
  return new Promise(() => {});
}
/**
 * Register the `start` command which launches or monitors the local server.
 *
 * @param program - Commander instance to augment.
 */
export default function (program: Command): void {
  program
    .command('start')
    .description('Start the SA-MP or open.mp server with optional watch mode')
    .option('-c, --config <file>', 'specify a custom config file')
    .option('-d, --debug', 'start with debug output')
    .option('-e, --existing', 'connect to existing server if running')
    .option('-w, --window', 'force start in a new window instead of terminal')
    .option('--watch', 'watch for file changes and auto-rebuild + restart')
    .action(async (options) => {
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

        // Smart server detection
        const serverInfo = detectServerType();
        
        if (!serverInfo) {
          logger.error('No server found in this directory.');
          logger.newline();
          logger.subheading('Expected server files:');
          logger.list([
            'open.mp: omp-server.exe + config.json',
            'SA-MP: samp-server.exe + server.cfg'
          ]);
          logger.newline();
          logger.info('Run "tapi init" to set up a new project with server files');
          process.exit(1);
        }

        // Handle watch mode
        if (options.watch) {
          await startWatchMode(serverInfo, options);
          return;
        }

        const serverTypeText = serverInfo.type === 'openmp' ? 'open.mp' : 'SA-MP';
        logger.heading(`Starting ${serverTypeText} server...`);

        // Validate configuration
        const configIssues = validateServerConfig(serverInfo);
        if (configIssues.length > 0) {
          logger.warn('Configuration issues detected:');
          for (const issue of configIssues) {
            logger.warn(`   - ${issue}`);
          }
          logger.newline();
        }

        // Use custom config if specified
        let configFile = serverInfo.configFile;
        if (options.config) {
          const customConfigPath = path.resolve(options.config);
          if (fs.existsSync(customConfigPath)) {
            configFile = customConfigPath;
            logger.routine(`Using custom config: ${path.basename(customConfigPath)}`);
          } else {
            logger.error(`Custom config file not found: ${options.config}`);
            process.exit(1);
          }
        }

        const args: string[] = [];

        // Add server-specific arguments
        if (serverInfo.type === 'openmp') {
          if (options.config) {
            args.push(`--config=${configFile}`);
          }
          if (options.debug) {
            args.push('--debug');
          }
        } else {
          // SA-MP doesn't support custom config paths in the same way
          if (options.debug) {
            args.push('-d'); // SA-MP debug flag
          }
        }

        logger.routine(`Working directory: ${process.cwd()}`);
        logger.routine(`Server executable: ${path.basename(serverInfo.executable)}`);
        logger.routine(`Config file: ${path.basename(configFile)}`);

        if (args.length > 0) {
          logger.routine(`Arguments: ${args.join(' ')}`);
        }

        // Show server info
        if (serverInfo.type === 'openmp') {
          const config = serverInfo.config as OpenMPConfig;
          if (config.hostname) {
            logger.routine(`Server name: ${config.hostname}`);
          }
          if (config.port) {
            logger.routine(`Port: ${config.port}`);
          }
          if (config.pawn?.main_scripts?.length) {
            logger.routine(`Gamemodes: ${config.pawn.main_scripts.join(', ')}`);
          }
        } else {
          const config = serverInfo.config as SAMPConfig;
          if (config.hostname) {
            logger.routine(`Server name: ${config.hostname}`);
          }
          if (config.port) {
            logger.routine(`Port: ${config.port}`);
          }
          if (config.gamemode0) {
            logger.routine(`Gamemode: ${config.gamemode0}`);
          }
        }

        // Server execution logic

        if (!options.window) {
          logger.newline();
          logger.info('Starting server in current terminal...');
          logger.info('Press Ctrl+C to stop the server');
          logger.newline();

          const serverProcess = spawn(serverInfo.executable, args, {
            stdio: ['inherit', 'pipe', 'pipe'], // Pipe stdout and stderr for formatting
            detached: false,
            shell: process.platform === 'win32',
            cwd: process.cwd(),
          });

          // Format and display server output
          if (serverProcess.stdout) {
            serverProcess.stdout.on('data', (data) => {
              const output = data.toString();
              formatServerOutput(output);
            });
          }

          if (serverProcess.stderr) {
            serverProcess.stderr.on('data', (data) => {
              const output = data.toString();
              formatServerOutput(output, true);
            });
          }

          if (serverProcess.pid) {
            saveServerState({
              pid: serverProcess.pid,
              serverPath: serverInfo.executable,
            });
            logger.routine(`Server started with PID: ${serverProcess.pid}`);
            logger.newline();
          }

          // Enhanced signal handling
          let shutdownInProgress = false;
          
          const gracefulShutdown = (signal: string) => {
            if (shutdownInProgress) return;
            shutdownInProgress = true;
            
            logger.newline();
            logger.routine(`Received ${signal}, stopping server...`);

            if (serverProcess.pid) {
              try {
                if (process.platform === 'win32') {
                  // Use taskkill for proper Windows signal handling
                  exec(`taskkill /PID ${serverProcess.pid} /T`, (error) => {
                    if (error && !error.message.includes('not found')) {
                      logger.warn(`Warning during shutdown: ${error.message}`);
                    }
                  });
                } else {
                  // Send SIGTERM first, then SIGKILL if needed
                  serverProcess.kill('SIGTERM');
                  setTimeout(() => {
                    if (serverProcess.pid && !serverProcess.killed) {
                      logger.warn('Server not responding, force killing...');
                      serverProcess.kill('SIGKILL');
                    }
                  }, 3000);
                }
              } catch (error) {
                logger.warn(
                  `Error during shutdown: ${error instanceof Error ? error.message : 'unknown error'}`
                );
              }
            }

            clearServerState();
          };

          // Handle Ctrl+C
          process.on('SIGINT', () => gracefulShutdown('SIGINT'));
          
          // Handle termination signal
          process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

          // Handle server process events
          serverProcess.on('exit', (code, signal) => {
            if (!shutdownInProgress) {
              logger.newline();
              
              if (signal) {
                logger.info(`Server stopped (signal: ${signal})`);
              } else if (code === 0) {
                logger.success('Server exited normally');
              } else {
                logger.warn(`Server exited with code ${code}`);
              }
              
              clearServerState();
              process.exit(code || 0);
            }
          });

          serverProcess.on('error', (error) => {
            logger.newline();
            logger.error(`Server error: ${error.message}`);
            clearServerState();
            process.exit(1);
          });

          return;
        }

        // Starting in a new window (legacy mode)
        logger.routine('Starting server in a new window (legacy mode)...');
        logger.info('Tip: Remove --window flag to run server inline with real-time output');

        if (process.platform === 'win32') {
          const batchFile = path.join(
            os.tmpdir(),
            `tapi-server-${Date.now()}.bat`
          );
          const batchContent = `@echo off
cd /d "${process.cwd()}"
start "${serverTypeText} Server" /min "${serverInfo.executable}" ${args.join(' ')}
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
            serverPath: serverInfo.executable,
            tempFiles: [batchFile],
          });

          logger.newline();
          logger.finalSuccess('Server started in a new window');
          logger.info('Check your taskbar for the server window');
        } else {
          let terminalCommand = '';

          if (process.env.TERM_PROGRAM === 'iTerm.app') {
            terminalCommand = `osascript -e 'tell application "iTerm" to create window with default profile command "${serverInfo.executable} ${args.join(' ')}"'`;
          } else if (fs.existsSync('/usr/bin/gnome-terminal')) {
            terminalCommand = `gnome-terminal -- ${serverInfo.executable} ${args.join(' ')}`;
          } else if (fs.existsSync('/usr/bin/xterm')) {
            terminalCommand = `xterm -e "${serverInfo.executable} ${args.join(' ')}"`;
          } else {
            logger.error(
              'Could not find a suitable terminal emulator. Please start the server manually.'
            );
            logger.newline();
            logger.subheading('Manual start command:');
            logger.command(`${serverInfo.executable} ${args.join(' ')}`);
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
            serverPath: serverInfo.executable,
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

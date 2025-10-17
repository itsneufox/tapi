import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Internal set of active log file streams used for file logging.
 */
interface LogStreams {
  latest?: fs.WriteStream;
  timestamped?: fs.WriteStream;
}

/**
 * Central logging utility that handles console output with verbosity controls
 * and optional log file persistence.
 */
class Logger {
  private logToFile: boolean = false;
  private logStreams: LogStreams = {};
  private verbosity: 'normal' | 'verbose' | 'quiet' = 'normal';

  /**
   * Enable writing log output to disk, either at a custom path or within the default logs directory.
   *
    * @param customPath - Optional absolute path to log file; when omitted both latest and timestamped logs are created.
   */
  enableFileLogging(customPath?: string) {
    this.logToFile = true;

    if (customPath) {
      this.setupSingleLog(customPath);
    } else {
      this.setupDualLogging();
    }
  }

  /**
   * Prepare a single log file at the provided location.
   *
   * @param filePath - Absolute path to a log file.
   */
  private setupSingleLog(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logStreams.latest = fs.createWriteStream(filePath, { flags: 'w' });
    this.info(`Logging to file: ${filePath}`);
  }

  /**
   * Create both latest.log and timestamped logs inside the default logs directory.
   */
  private setupDualLogging() {
    const { latest, timestamped } = this.getLogPaths();

    const logsDir = path.dirname(latest);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logStreams.latest = fs.createWriteStream(latest, { flags: 'w' });
    this.logStreams.timestamped = fs.createWriteStream(timestamped, {
      flags: 'w',
    });

    this.info(`Logging to: ${latest} (and ${path.basename(timestamped)})`);
  }

  /**
   * Compute the latest.log and timestamped log file locations.
   */
  private getLogPaths(): { latest: string; timestamped: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const logsDir = path.join(os.homedir(), '.tapi', 'logs');

    return {
      latest: path.join(logsDir, 'latest.log'),
      timestamped: path.join(logsDir, `tapi-${timestamp}.log`),
    };
  }

  /**
   * Persist a message to the active log file(s) if file logging is enabled.
   *
   * @param level - Log level tag to prefix in the file.
   * @param message - Message to write.
   */
  private writeToFile(level: string, message: string) {
    if (!this.logToFile) return;

    const timestamp = new Date().toISOString();
    // Strip color codes from the message before writing to file
    // eslint-disable-next-line no-control-regex
    const cleanMessage = message.replace(/\u001b\[\d+m/g, '');
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${cleanMessage}\n`;

    if (this.logStreams.latest) {
      this.logStreams.latest.write(logLine);
    }
    if (this.logStreams.timestamped) {
      this.logStreams.timestamped.write(logLine);
    }
  }

  /**
   * Configure the verbosity threshold for console output.
   */
  setVerbosity(level: 'normal' | 'verbose' | 'quiet') {
    this.verbosity = level;
  }

  /**
   * Get the current verbosity mode.
   */
  getVerbosity(): 'normal' | 'verbose' | 'quiet' {
    return this.verbosity;
  }

  // Basic logging methods
  /**
   * Log a success message.
   */
  success(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`✓ ${message}`);
    }
    this.writeToFile('success', message);
  }

  /**
   * Log an error message.
   */
  error(message: string) {
    if (this.verbosity !== 'quiet') {
      console.error(`✗ ${message}`);
    }
    this.writeToFile('error', message);
  }

  /**
   * Log an informational message.
   */
  info(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`${message}`);
    }
    this.writeToFile('info', message);
  }

  /**
   * Log a routine status message (prefixed with an arrow).
   */
  routine(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`→ ${message}`);
    }
    this.writeToFile('routine', message);
  }

  /**
   * Log a detailed message when in verbose mode.
   */
  detail(message: string) {
    if (this.verbosity === 'verbose') {
      console.log(`  ${message}`);
    }
    this.writeToFile('detail', message);
  }

  /**
   * Log a warning message.
   */
  warn(message: string) {
    if (this.verbosity !== 'quiet') {
      console.warn(`${message}`);
    }
    this.writeToFile('warn', message);
  }

  /**
   * Log a message with no prefix.
   */
  plain(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(message);
    }
    this.writeToFile('plain', message);
  }

  /**
   * Emit a blank line to the console (and file output).
   */
  newline() {
    if (this.verbosity !== 'quiet') {
      console.log();
    }
    this.writeToFile('newline', '');
  }

  // Heading methods
  /**
   * Log a formatted heading surrounded by === markers.
   */
  heading(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n=== ${message} ===`);
    }
    this.writeToFile('heading', message);
  }

  /**
   * Log a formatted subheading surrounded by --- markers.
   */
  subheading(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n--- ${message} ---`);
    }
    this.writeToFile('subheading', message);
  }

  // Success methods
  /**
   * Log a final success message preceded by a newline.
   */
  finalSuccess(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n${message}`);
    }
    this.writeToFile('finalSuccess', message);
  }

  // List methods
  /**
   * Log a list of bullet items.
   */
  list(items: string[]) {
    if (this.verbosity !== 'quiet') {
      items.forEach((item) => {
        console.log(`  - ${item}`);
      });
    }
    this.writeToFile('list', items.join(', '));
  }

  // Working/progress methods
  /**
   * Log a message with ellipsis for ongoing work.
   */
  working(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`${message}...`);
    }
    this.writeToFile('working', message);
  }

  // Key-value display
  /**
   * Log a two-column key/value line.
   */
  keyValue(key: string, value: string) {
    const line = `${key}: ${value}`;
    if (this.verbosity !== 'quiet') {
      console.log(`  ${line}`);
    }
    this.writeToFile('keyvalue', line);
  }

  // Command display method
  /**
   * Log a shell command (prefixed with `$`). 
   */
  command(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`$ ${message}`);
    }
    this.writeToFile('command', message);
  }

  link(url: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`🔗 ${url}`);
    }
    this.writeToFile('link', url);
  }

  // Clean up streams when done
  close() {
    if (this.logStreams.latest) {
      this.logStreams.latest.end();
    }
    if (this.logStreams.timestamped) {
      this.logStreams.timestamped.end();
    }
  }
}

export const logger = new Logger();

// Handle process exit to close streams
process.on('exit', () => {
  logger.close();
});

process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.close();
  process.exit(0);
});

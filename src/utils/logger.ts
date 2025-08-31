import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface LogStreams {
  latest?: fs.WriteStream;
  timestamped?: fs.WriteStream;
}

class Logger {
  private logToFile: boolean = false;
  private logStreams: LogStreams = {};
  private verbosity: 'normal' | 'verbose' | 'quiet' = 'normal';

  enableFileLogging(customPath?: string) {
    this.logToFile = true;

    if (customPath) {
      this.setupSingleLog(customPath);
    } else {
      this.setupDualLogging();
    }
  }

  private setupSingleLog(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logStreams.latest = fs.createWriteStream(filePath, { flags: 'w' });
    this.info(`Logging to file: ${filePath}`);
  }

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

  private getLogPaths(): { latest: string; timestamped: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const logsDir = path.join(os.homedir(), '.pawnctl', 'logs');

    return {
      latest: path.join(logsDir, 'latest.log'),
      timestamped: path.join(logsDir, `pawnctl-${timestamp}.log`),
    };
  }

  private writeToFile(level: string, message: string) {
    if (!this.logToFile) return;

    const timestamp = new Date().toISOString();
    // Strip color codes from the message before writing to file
    const cleanMessage = message.replace(/\u001b\[\d+m/g, '');
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${cleanMessage}\n`;

    if (this.logStreams.latest) {
      this.logStreams.latest.write(logLine);
    }
    if (this.logStreams.timestamped) {
      this.logStreams.timestamped.write(logLine);
    }
  }

  setVerbosity(level: 'normal' | 'verbose' | 'quiet') {
    this.verbosity = level;
  }

  getVerbosity(): 'normal' | 'verbose' | 'quiet' {
    return this.verbosity;
  }

  // Basic logging methods
  success(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`✓ ${message}`);
    }
    this.writeToFile('success', message);
  }

  error(message: string) {
    if (this.verbosity !== 'quiet') {
      console.error(`✗ ${message}`);
    }
    this.writeToFile('error', message);
  }

  info(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`ℹ ${message}`);
    }
    this.writeToFile('info', message);
  }

  routine(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`→ ${message}`);
    }
    this.writeToFile('routine', message);
  }

  detail(message: string) {
    if (this.verbosity === 'verbose') {
      console.log(`  ${message}`);
    }
    this.writeToFile('detail', message);
  }

  warn(message: string) {
    if (this.verbosity !== 'quiet') {
      console.warn(`⚠ ${message}`);
    }
    this.writeToFile('warn', message);
  }

  plain(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(message);
    }
    this.writeToFile('plain', message);
  }

  newline() {
    if (this.verbosity !== 'quiet') {
      console.log();
    }
    this.writeToFile('newline', '');
  }

  // Heading methods
  heading(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n=== ${message} ===`);
    }
    this.writeToFile('heading', message);
  }

  subheading(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n--- ${message} ---`);
    }
    this.writeToFile('subheading', message);
  }

  // Success methods
  finalSuccess(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`\n🎉 ${message}`);
    }
    this.writeToFile('finalSuccess', message);
  }

  // List methods
  list(items: string[]) {
    if (this.verbosity !== 'quiet') {
      items.forEach((item) => {
        console.log(`  • ${item}`);
      });
    }
    this.writeToFile('list', items.join(', '));
  }

  // Working/progress methods
  working(message: string) {
    if (this.verbosity !== 'quiet') {
      console.log(`⏳ ${message}...`);
    }
    this.writeToFile('working', message);
  }

  // Key-value display
  keyValue(key: string, value: string) {
    const line = `${key}: ${value}`;
    if (this.verbosity !== 'quiet') {
      console.log(`  ${line}`);
    }
    this.writeToFile('keyvalue', line);
  }

  // Command display method
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

import chalk from 'chalk';

export type VerbosityLevel = 'quiet' | 'normal' | 'verbose';

class ChalkLogger {
  private verbosity: VerbosityLevel = 'normal';

  setVerbosity(level: VerbosityLevel): void {
    this.verbosity = level;
  }

  getVerbosity(): VerbosityLevel {
    return this.verbosity;
  }

  private shouldLog(level: 'quiet' | 'normal' | 'verbose'): boolean {
    if (this.verbosity === 'quiet') return false;
    if (this.verbosity === 'normal') return level !== 'verbose';
    return true;
  }

  plain(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.log(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.blue('ℹ'), message, ...args);
    }
  }

  routine(message: string, ...args: unknown[]): void {
    if (this.shouldLog('verbose')) {
      console.log(chalk.blue('[ROUTINE]'), message, ...args);
    }
  }

  detail(message: string, ...args: unknown[]): void {
    if (this.shouldLog('verbose')) {
      console.log(chalk.cyan('[DETAIL]'), message, ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.green('✅'), message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.log(chalk.yellow('⚠️'), message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red('❌'), message, ...args);
  }

  finalSuccess(message: string, ...args: unknown[]): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.green.bold('🎉'), chalk.green(message), ...args);
    }
  }

  heading(message: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.cyan.bold(`\n${message}`));
    }
  }

  subheading(message: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.cyan(`${message}`));
    }
  }

  command(message: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.gray('$'), chalk.white(message));
    }
  }

  link(url: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.blue.underline(url));
    }
  }

  code(code: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.gray('`') + chalk.white(code) + chalk.gray('`'));
    }
  }

  // progress indicators
  working(message: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.blue('⚙️'), message);
    }
  }

  step(step: number, total: number, message: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.blue(`[${step}/${total}]`), message);
    }
  }

  // file operations
  fileCreated(filename: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.green('✨'), `Created ${chalk.cyan(filename)}`);
    }
  }

  fileUpdated(filename: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.yellow('📝'), `Updated ${chalk.cyan(filename)}`);
    }
  }

  fileDeleted(filename: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.red('🗑️'), `Deleted ${chalk.cyan(filename)}`);
    }
  }

  keyValue(key: string, value: string): void {
    if (this.shouldLog('normal')) {
      console.log(chalk.gray('•'), chalk.cyan(key + ':'), chalk.white(value));
    }
  }

  list(items: string[]): void {
    if (this.shouldLog('normal')) {
      items.forEach((item) => {
        console.log(chalk.gray('  •'), item);
      });
    }
  }

  // empty line for spacing
  newline(): void {
    if (this.shouldLog('normal')) {
      console.log();
    }
  }
}

export const logger = new ChalkLogger();

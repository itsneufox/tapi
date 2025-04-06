export type VerbosityLevel = 'quiet' | 'normal' | 'verbose';
let currentVerbosity: VerbosityLevel = 'normal';

export const logger = {
  setVerbosity: (level: VerbosityLevel) => {
    currentVerbosity = level;
  },

  getVerbosity: (): VerbosityLevel => {
    return currentVerbosity;
  },

  plain: (message: string, ...args: unknown[]) => {
    if (currentVerbosity !== 'quiet') {
      console.log(message, ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (currentVerbosity !== 'quiet') {
      console.log(`\x1b[34m[INFO]\x1b[0m ${message}`, ...args);
    }
  },

  routine: (message: string, ...args: unknown[]) => {
    if (currentVerbosity === 'verbose') {
      console.log(`\x1b[34m[INFO]\x1b[0m ${message}`, ...args);
    }
  },

  detail: (message: string, ...args: unknown[]) => {
    if (currentVerbosity === 'verbose') {
      console.log(`\x1b[36m[DETAIL]\x1b[0m ${message}`, ...args);
    }
  },

  success: (message: string, ...args: unknown[]) => {
    if (currentVerbosity !== 'quiet') {
      console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    console.log(`\x1b[33m[WARN]\x1b[0m ${message}`, ...args);
  },

  error: (message: string, ...args: unknown[]) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`, ...args);
  },

  finalSuccess: (message: string, ...args: unknown[]) => {
    console.log(`\x1b[32m${message}\x1b[0m`, ...args);
  },
};

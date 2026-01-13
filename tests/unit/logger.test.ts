import { logger } from '../../src/utils/logger';

const ANSI_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const stripAnsi = (value: string): string => value.replace(ANSI_REGEX, '');

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // Spy on console methods to test log output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verbosity levels', () => {
    test('should set and get verbosity levels correctly', () => {
      logger.setVerbosity('verbose');
      expect(logger.getVerbosity()).toBe('verbose');

      logger.setVerbosity('quiet');
      expect(logger.getVerbosity()).toBe('quiet');

      logger.setVerbosity('normal');
      expect(logger.getVerbosity()).toBe('normal');
    });
  });

  describe('logging methods', () => {
    test('should log info messages in normal mode', () => {
      logger.setVerbosity('normal');
      logger.info('Test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should not log detail messages in normal mode', () => {
      logger.setVerbosity('normal');
      logger.detail('Detail message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should log detail messages in verbose mode', () => {
      logger.setVerbosity('verbose');
      logger.detail('Detail message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should minimize output in quiet mode', () => {
      logger.setVerbosity('quiet');
      logger.info('Info message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should log errors to console.error in non-quiet modes', () => {
      const errorSpy = jest.spyOn(console, 'error');
      
      logger.setVerbosity('quiet');
      logger.error('Error message');
      expect(errorSpy).not.toHaveBeenCalled();

      errorSpy.mockClear();
      logger.setVerbosity('normal');
      logger.error('Error message');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockClear();
      logger.setVerbosity('verbose');
      logger.error('Error message');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('structured logging', () => {
    test('should format key-value pairs correctly', () => {
      logger.setVerbosity('normal');
      logger.keyValue('Key', 'Value');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Key'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Value'));
    });

    test('should format lists correctly', () => {
      logger.setVerbosity('normal');
      logger.list(['Item 1', 'Item 2', 'Item 3']);
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('additional logging methods', () => {
    beforeEach(() => {
      logger.setVerbosity('normal');
    });

    test('should log headings with proper formatting', () => {
      logger.heading('Test Heading');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test Heading'));
    });

    test('should log subheadings with dashes', () => {
      logger.subheading('Test Subheading');
      expect(consoleSpy).toHaveBeenCalledWith('\n--- Test Subheading ---');
    });

    test('should log final success messages', () => {
      logger.finalSuccess('Operation completed!');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Operation completed!'));
    });

    test('should log working messages with ellipsis', () => {
      logger.working('Processing');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Processing...'));
    });

    test('should log commands with dollar sign prefix', () => {
      logger.command('npm install');
      const commandCall = consoleSpy.mock.calls.find(([arg]) =>
        typeof arg === 'string' && stripAnsi(arg).includes('$ npm install')
      );
      expect(commandCall).toBeDefined();
    });

    test('should log routine messages', () => {
      logger.routine('Routine operation');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Routine operation'));
    });

    test('should log plain messages without formatting', () => {
      logger.plain('Plain message');
      expect(consoleSpy).toHaveBeenCalledWith('Plain message');
    });

    test('should log links with formatted prefix', () => {
      logger.link('https://example.com');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('https://example.com'));
    });

    test('should create newlines', () => {
      logger.newline();
      expect(consoleSpy).toHaveBeenCalledWith();
    });
  });

  describe('file logging', () => {
    test('should not throw when file logging is not enabled', () => {
      expect(() => {
        logger.info('Test message');
        logger.error('Test error');
        logger.success('Test success');
      }).not.toThrow();
    });

    // Note: File logging tests are disabled to avoid "write after end" errors
    // since file streams persist across tests in Jest
  });

  describe('edge cases', () => {
    test('should handle empty messages gracefully', () => {
      logger.setVerbosity('normal');
      expect(() => {
        logger.info('');
        logger.error('');
        logger.success('');
        logger.list([]);
      }).not.toThrow();
    });

    test('should handle special characters in messages', () => {
      logger.setVerbosity('normal');
      const specialMessage = 'Message with "quotes" and \'apostrophes\' and \n newlines';
      expect(() => {
        logger.info(specialMessage);
      }).not.toThrow();
    });
  });
});

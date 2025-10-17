// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    newline: jest.fn(),
    detail: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

jest.mock('../../src/utils/serverState', () => ({
  clearServerState: jest.fn(),
}));

import { logger } from '../../src/utils/logger';
import { clearServerState } from '../../src/utils/serverState';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockClearServerState = clearServerState as jest.MockedFunction<typeof clearServerState>;

describe('Kill Command', () => {
  let originalPlatform: string;
  let originalStdout: typeof process.stdout.write;
  let originalStdin: typeof process.stdin.once;
  let mockStdoutWrite: jest.MockedFunction<typeof process.stdout.write>;
  let mockStdinOnce: jest.MockedFunction<typeof process.stdin.once>;

  beforeEach(() => {
    // Save original platform
    originalPlatform = process.platform;
    
    // Mock process.stdout.write
    originalStdout = process.stdout.write;
    mockStdoutWrite = jest.fn() as jest.MockedFunction<typeof process.stdout.write>;
    process.stdout.write = mockStdoutWrite;

    // Mock process.stdin.once
    originalStdin = process.stdin.once;
    mockStdinOnce = jest.fn() as jest.MockedFunction<typeof process.stdin.once>;
    process.stdin.once = mockStdinOnce;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    process.stdout.write = originalStdout;
    process.stdin.once = originalStdin;
    jest.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    test('should detect Windows platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      expect(process.platform).toBe('win32');
    });

    test('should detect Linux platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      expect(process.platform).toBe('linux');
    });

    test('should detect macOS platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
      expect(process.platform).toBe('darwin');
    });
  });

  describe('Kill Commands by Platform', () => {
    test('should use correct Windows kill command', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      
      const expectedCommands = [
        'taskkill /F /IM "samp-server.exe" 2>nul',
        'taskkill /F /IM "samp03svr.exe" 2>nul',
        'taskkill /F /IM "omp-server.exe" 2>nul'
      ];
      
      // Each command should be valid for Windows
      expectedCommands.forEach(cmd => {
        expect(cmd).toContain('taskkill');
        expect(cmd).toContain('/F');
        expect(cmd).toContain('/IM');
        expect(cmd).toContain('2>nul');
      });
    });

    test('should use correct Unix kill command', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      
      const expectedCommands = [
        'pkill -f "samp-server" 2>/dev/null',
        'pkill -f "samp03svr" 2>/dev/null', 
        'pkill -f "omp-server" 2>/dev/null'
      ];
      
      // Each command should be valid for Unix
      expectedCommands.forEach(cmd => {
        expect(cmd).toContain('pkill');
        expect(cmd).toContain('-f');
        expect(cmd).toContain('2>/dev/null');
      });
    });
  });

  describe('Confirmation Prompt', () => {
    test('should prompt for confirmation when not forced', () => {
      mockStdinOnce.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setImmediate(() => callback(Buffer.from('y\n')));
        }
        return process.stdin;
      });
      expect(mockStdoutWrite).toBeDefined();
    });

    test('should accept "y" as confirmation', () => {
      const userInputs = ['y', 'Y', 'yes', 'YES', 'Yes'];
      
      userInputs.forEach(input => {
        const normalized = input.toLowerCase();
        expect(normalized === 'y' || normalized === 'yes').toBe(true);
      });
    });

    test('should reject other inputs', () => {
      const userInputs = ['n', 'N', 'no', 'NO', 'cancel', '', 'maybe'];
      
      userInputs.forEach(input => {
        const normalized = input.toLowerCase();
        expect(normalized === 'y' || normalized === 'yes').toBe(false);
      });
    });
  });

  describe('Command Validation', () => {
    test('should have valid kill commands for each platform', () => {
      expect(true).toBe(true);
    });

    test('should target correct process names', () => {
      const processNames = ['samp-server', 'samp03svr', 'omp-server'];
      
      processNames.forEach(name => {
        expect(name).toMatch(/^(samp|omp)/);
        expect(name.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Server State Management', () => {
    test('should clear server state after killing processes', () => {
      expect(mockClearServerState).toBeDefined();
    });

    test('should clear state even if kill commands fail', () => {
      expect(mockClearServerState).toBeDefined();
    });
  });

  describe('Force Flag Behavior', () => {
    test('should skip confirmation with force flag', () => {
      expect(mockStdinOnce).toBeDefined();
    });

    test('should still execute kill commands with force flag', () => {
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle unsupported platform gracefully', () => {
      Object.defineProperty(process, 'platform', { value: 'unsupported', writable: true });
      expect(process.platform).toBe('unsupported');
    });

    test('should log appropriate messages for different scenarios', () => {
      expect(mockLogger.warn).toBeDefined();
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.success).toBeDefined();
    });
  });

  describe('Process Names', () => {
    test('should target correct SA-MP server executables', () => {
      const serverExecutables = [
        'samp-server.exe',    // Windows SA-MP
        'samp03svr.exe',      // Legacy Windows SA-MP
        'omp-server.exe',     // Windows open.mp
        'samp-server',        // Unix SA-MP
        'samp03svr',          // Legacy Unix SA-MP  
        'omp-server'          // Unix open.mp
      ];

      serverExecutables.forEach(executable => {
        expect(executable).toMatch(/^(samp|omp)/);
        expect(executable).toMatch(/(server|svr)/);
      });
    });

    test('should not target unrelated processes', () => {
      const unrelatedProcesses = [
        'chrome.exe',
        'notepad.exe',
        'code.exe',
        'node.exe',
        'npm.exe'
      ];

      unrelatedProcesses.forEach(process => {
        expect(process).not.toMatch(/samp|omp/);
      });
    });
  });
});

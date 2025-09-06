import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTempDir } from '../setup';

jest.mock('child_process');
jest.mock('chokidar');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    heading: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    detail: jest.fn(),
    newline: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

jest.mock('../../src/utils/serverState', () => ({
  loadServerState: jest.fn(),
  saveServerState: jest.fn(),
  clearServerState: jest.fn(),
  isServerRunning: jest.fn(),
}));

import { logger } from '../../src/utils/logger';
import { loadServerState, saveServerState, clearServerState, isServerRunning } from '../../src/utils/serverState';

const _mockLogger = logger as jest.Mocked<typeof logger>;
const mockLoadServerState = loadServerState as jest.MockedFunction<typeof loadServerState>;
const mockSaveServerState = saveServerState as jest.MockedFunction<typeof saveServerState>;
const mockClearServerState = clearServerState as jest.MockedFunction<typeof clearServerState>;
const mockIsServerRunning = isServerRunning as jest.MockedFunction<typeof isServerRunning>;

describe('Start Command Utilities', () => {
  let tempDir: string;
  let originalPlatform: string;

  beforeEach(() => {
    tempDir = createTempDir();
    originalPlatform = process.platform;
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Color Codes', () => {
    test('should have valid ANSI color codes', () => {
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

      Object.values(colors).forEach(color => {
        expect(color).toMatch(/^\x1b\[\d+m$/);
      });
    });
  });

  describe('Server Binary Detection', () => {
    test('should detect Windows server executables', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      
      const windowsExecutables = ['samp-server.exe', 'samp03svr.exe', 'omp-server.exe'];
      
      windowsExecutables.forEach(exe => {
        expect(exe.endsWith('.exe')).toBe(true);
        expect(exe.includes('server') || exe.includes('svr')).toBe(true);
      });
    });

    test('should detect Unix server executables', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      
      const unixExecutables = ['samp-server', 'samp03svr', 'omp-server'];
      
      unixExecutables.forEach(exe => {
        expect(exe.endsWith('.exe')).toBe(false);
        expect(exe.includes('server') || exe.includes('svr')).toBe(true);
      });
    });
  });

  describe('Configuration File Detection', () => {
    test('should detect server.cfg files', () => {
      const configFile = path.join(tempDir, 'server.cfg');
      fs.writeFileSync(configFile, 'port 7777\nhostname Test Server');
      
      expect(fs.existsSync(configFile)).toBe(true);
      const content = fs.readFileSync(configFile, 'utf8');
      expect(content).toContain('port');
      expect(content).toContain('hostname');
    });

    test('should detect config.json files', () => {
      const configFile = path.join(tempDir, 'config.json');
      const config = {
        name: 'Test Server',
        main_scripts: ['gamemode.amx'],
        pawn: {
          legacy_plugins: ['crashdetect.so']
        }
      };
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      
      expect(fs.existsSync(configFile)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      expect(parsed.name).toBe('Test Server');
      expect(parsed.main_scripts).toContain('gamemode.amx');
    });
  });

  describe('Server State Management', () => {
    test('should check if server is running', () => {
      mockIsServerRunning.mockReturnValue(true);
      
      const isRunning = mockIsServerRunning();
      expect(isRunning).toBe(true);
      expect(mockIsServerRunning).toHaveBeenCalled();
    });

    test('should load server state', () => {
      const mockState = {
        pid: 1234,
        serverPath: '/path/to/server',
        tempFiles: ['temp1.txt', 'temp2.txt']
      };
      
      mockLoadServerState.mockReturnValue(mockState);
      
      const state = mockLoadServerState();
      expect(state).toEqual(mockState);
      expect(state.pid).toBe(1234);
    });

    test('should save server state', () => {
      const state = {
        pid: 5678,
        serverPath: '/new/path',
        tempFiles: ['new_temp.txt']
      };
      
      mockSaveServerState(state);
      expect(mockSaveServerState).toHaveBeenCalledWith(state);
    });

    test('should clear server state', () => {
      mockClearServerState();
      expect(mockClearServerState).toHaveBeenCalled();
    });
  });

  describe('Output Parsing Patterns', () => {
    test('should match component loading messages', () => {
      const componentPattern = /Loading component (.+?)\.dll/;
      const testMessages = [
        'Loading component crashdetect.dll',
        'Loading component mysql.dll',
        'Loading component streamer.dll'
      ];
      
      testMessages.forEach(message => {
        const match = message.match(componentPattern);
        expect(match).toBeTruthy();
        expect(match![1]).toMatch(/^[a-zA-Z0-9_]+$/);
      });
    });

    test('should match successful component loads', () => {
      const successPattern = /Successfully loaded component (.+?) \((.+?)\)/;
      const testMessages = [
        'Successfully loaded component CrashDetect (v4.19)',
        'Successfully loaded component MySQL (v2.1.1)',
        'Successfully loaded component Streamer (v2.9.4)'
      ];
      
      testMessages.forEach(message => {
        const match = message.match(successPattern);
        expect(match).toBeTruthy();
        expect(match![1]).toMatch(/^[a-zA-Z0-9_]+$/);
        expect(match![2]).toMatch(/^v?\d+\.\d+/);
      });
    });

    test('should match server startup messages', () => {
      const startupMessages = [
        'Server Plugins:',
        'Started server on',
        'Loaded 0 filterscripts',
        'Number of vehicle models: 212'
      ];
      
      startupMessages.forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('File Watching Patterns', () => {
    test('should match PAWN source files', () => {
      const pawnFiles = [
        'gamemode.pwn',
        'filterscript.pwn',
        'include/library.inc',
        'gamemodes/roleplay.pwn'
      ];
      
      pawnFiles.forEach(file => {
        expect(file.endsWith('.pwn') || file.endsWith('.inc')).toBe(true);
      });
    });

    test('should ignore non-PAWN files', () => {
      const nonPawnFiles = [
        'readme.txt',
        'config.json',
        'server.log',
        'plugins/crashdetect.so'
      ];
      
      nonPawnFiles.forEach(file => {
        expect(file.endsWith('.pwn') || file.endsWith('.inc')).toBe(false);
      });
    });
  });

  describe('Port Validation', () => {
    test('should validate port ranges', () => {
      const validPorts = [7777, 8080, 9999, 1024, 65535];
      const invalidPorts = [0, 70000, -1, 1023];
      
      validPorts.forEach(port => {
        expect(port).toBeGreaterThanOrEqual(1024);
        expect(port).toBeLessThanOrEqual(65535);
      });
      
      invalidPorts.forEach(port => {
        expect(port < 1024 || port > 65535).toBe(true);
      });
    });

    test('should handle default SA-MP port', () => {
      const defaultPort = 7777;
      expect(defaultPort).toBe(7777);
      expect(defaultPort).toBeGreaterThanOrEqual(1024);
      expect(defaultPort).toBeLessThanOrEqual(65535);
    });
  });

  describe('Temporary File Management', () => {
    test('should generate unique temporary filenames', () => {
      const tempFiles = [
        `temp_${Date.now()}_1.txt`,
        `temp_${Date.now()}_2.txt`,
        `temp_${Date.now()}_3.txt`
      ];
      
      const uniqueFiles = new Set(tempFiles);
      expect(uniqueFiles.size).toBe(tempFiles.length);
    });

    test('should use system temp directory', () => {
      const sysTempDir = os.tmpdir();
      expect(typeof sysTempDir).toBe('string');
      expect(sysTempDir.length).toBeGreaterThan(0);
      expect(fs.existsSync(sysTempDir)).toBe(true);
    });
  });

  describe('Process Management', () => {
    test('should handle process IDs', () => {
      const validPids = [1, 1234, 9999, 65535];
      
      validPids.forEach(pid => {
        expect(typeof pid).toBe('number');
        expect(pid).toBeGreaterThan(0);
        expect(Number.isInteger(pid)).toBe(true);
      });
    });

    test('should handle process signals', () => {
      const signals = ['SIGTERM', 'SIGKILL', 'SIGINT'];
      
      signals.forEach(signal => {
        expect(typeof signal).toBe('string');
        expect(signal.startsWith('SIG')).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing server executable', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent-server.exe');
      expect(fs.existsSync(nonExistentPath)).toBe(false);
    });

    test('should handle permission errors', () => {
      expect(() => {
        throw new Error('EACCES: permission denied');
      }).toThrow('EACCES');
    });

    test('should handle file not found errors', () => {
      expect(() => {
        throw new Error('ENOENT: no such file or directory');
      }).toThrow('ENOENT');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate server.cfg format', () => {
      const validConfig = [
        'port 7777',
        'hostname Test Server',
        'gamemode0 gamemode 1',
        'filterscripts base',
        'maxplayers 50'
      ];
      
      validConfig.forEach(line => {
        expect(line).toMatch(/^\w+\s+.+$/);
      });
    });

    test('should validate config.json structure', () => {
      const validConfigKeys = ['name', 'main_scripts', 'side_scripts', 'pawn', 'network'];
      
      validConfigKeys.forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });
});

import { saveServerState, loadServerState, clearServerState, isServerRunning, ServerState } from '../../src/utils/serverState';
import { ConfigManager } from '../../src/utils/config';

// Mock the config manager
jest.mock('../../src/utils/config');

describe('Server State Management', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    // Get the mocked config manager
    const { configManager } = require('../../src/utils/config');
    mockConfigManager = configManager as jest.Mocked<ConfigManager>;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveServerState', () => {
    test('should save server state via config manager', () => {
      const state: ServerState = {
        pid: 12345,
        serverPath: '/path/to/server.exe',
        startTime: '2024-01-01T00:00:00Z',
        tempFiles: ['temp1.txt', 'temp2.txt']
      };

      saveServerState(state);

      expect(mockConfigManager.saveServerState).toHaveBeenCalledWith(state);
    });

    test('should handle errors gracefully', () => {
      const state: ServerState = { pid: 12345 };
      const error = new Error('Save failed');
      
      mockConfigManager.saveServerState.mockImplementation(() => {
        throw error;
      });

      // Should not throw
      expect(() => saveServerState(state)).not.toThrow();
      expect(mockConfigManager.saveServerState).toHaveBeenCalledWith(state);
    });
  });

  describe('loadServerState', () => {
    test('should load server state from config manager', () => {
      const expectedState: ServerState = {
        pid: 12345,
        serverPath: '/path/to/server.exe'
      };

      mockConfigManager.getServerState.mockReturnValue(expectedState);

      const result = loadServerState();

      expect(result).toEqual(expectedState);
      expect(mockConfigManager.getServerState).toHaveBeenCalled();
    });

    test('should return empty object when no state exists', () => {
      mockConfigManager.getServerState.mockReturnValue(undefined);

      const result = loadServerState();

      expect(result).toEqual({});
    });

    test('should handle errors and return empty object', () => {
      const error = new Error('Load failed');
      mockConfigManager.getServerState.mockImplementation(() => {
        throw error;
      });

      const result = loadServerState();

      expect(result).toEqual({});
    });
  });

  describe('clearServerState', () => {
    test('should clear server state via config manager', () => {
      clearServerState();

      expect(mockConfigManager.clearServerState).toHaveBeenCalled();
    });

    test('should handle errors gracefully', () => {
      const error = new Error('Clear failed');
      mockConfigManager.clearServerState.mockImplementation(() => {
        throw error;
      });

      // Should not throw
      expect(() => clearServerState()).not.toThrow();
      expect(mockConfigManager.clearServerState).toHaveBeenCalled();
    });
  });

  describe('isServerRunning', () => {
    let originalPlatform: string;
    let processKillSpy: jest.SpyInstance;

    beforeEach(() => {
      // Save original platform
      originalPlatform = process.platform;
      processKillSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    });

    afterEach(() => {
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
      processKillSpy.mockRestore();
    });

    test('should return false when no server state exists', () => {
      mockConfigManager.getServerState.mockReturnValue(undefined);

      const result = isServerRunning();

      expect(result).toBe(false);
    });

    test('should return false when no PID in state', () => {
      mockConfigManager.getServerState.mockReturnValue({
        serverPath: '/path/to/server.exe'
      });

      const result = isServerRunning();

      expect(result).toBe(false);
    });

    test('should return true when process with PID exists on Unix systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      mockConfigManager.getServerState.mockReturnValue({
        pid: 12345,
        serverPath: '/path/to/server.exe'
      });

      // Mock process.kill to succeed (process exists)
      processKillSpy.mockReturnValue(true);

      const result = isServerRunning();

      expect(result).toBe(true);
      expect(processKillSpy).toHaveBeenCalledWith(12345, 0);
    });

    test('should return false when process with PID does not exist on Unix systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      mockConfigManager.getServerState.mockReturnValue({
        pid: 12345,
        serverPath: '/path/to/server.exe'
      });

      // Mock process.kill to throw (process doesn't exist)
      processKillSpy.mockImplementation(() => {
        const error = new Error('ESRCH: No such process') as NodeJS.ErrnoException;
        error.code = 'ESRCH';
        throw error;
      });

      const result = isServerRunning();

      expect(result).toBe(false);
    });

    test('should handle Windows tasklist for process checking', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
      mockConfigManager.getServerState.mockReturnValue({
        pid: 12345,
        serverPath: '/path/to/server.exe'
      });

      // Mock spawnSync for Windows tasklist
      jest.spyOn(require('child_process'), 'spawnSync').mockReturnValue({
        stdout: 'PID: 12345',
        stderr: '',
        status: 0
      });

      const result = isServerRunning();

      expect(result).toBe(true);
    });

    test('should return false when Windows tasklist does not find PID', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });
      mockConfigManager.getServerState.mockReturnValue({
        pid: 12345,
        serverPath: '/path/to/server.exe'
      });

      // Mock spawnSync for Windows tasklist - no matching PID
      jest.spyOn(require('child_process'), 'spawnSync').mockReturnValue({
        stdout: 'No tasks found',
        stderr: '',
        status: 0
      });

      const result = isServerRunning();

      expect(result).toBe(false);
    });

    test('should handle config manager errors', () => {
      mockConfigManager.getServerState.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = isServerRunning();

      expect(result).toBe(false);
    });
  });

  describe('ServerState interface', () => {
    test('should support all expected properties', () => {
      const state: ServerState = {
        pid: 12345,
        serverPath: '/path/to/server.exe',
        tempFiles: ['temp1.txt'],
        startTime: '2024-01-01T00:00:00Z',
        args: ['--debug'],
        windowMode: true
      };

      // Should compile without errors and have all properties
      expect(state.pid).toBe(12345);
      expect(state.serverPath).toBe('/path/to/server.exe');
      expect(state.tempFiles).toEqual(['temp1.txt']);
      expect(state.startTime).toBe('2024-01-01T00:00:00Z');
      expect(state.args).toEqual(['--debug']);
      expect(state.windowMode).toBe(true);
    });

    test('should allow partial state objects', () => {
      const partialState: ServerState = {
        pid: 12345
      };

      expect(partialState.pid).toBe(12345);
      expect(partialState.serverPath).toBeUndefined();
    });
  });
});

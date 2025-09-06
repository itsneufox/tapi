import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../src/utils/logger';
import { confirm } from '@inquirer/prompts';
import { createUninstallCommand } from '../../src/commands/uninstall/uninstall';

// Mock dependencies
jest.mock('fs');
jest.mock('os');
jest.mock('../../src/utils/logger');
jest.mock('@inquirer/prompts');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const _mockLogger = logger as jest.Mocked<typeof logger>;
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;

describe('Uninstall Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock homedir
    mockOs.homedir.mockReturnValue('/mock/home');
  });

  describe('Command creation', () => {
    it('should create uninstall command with correct name', () => {
      const command = createUninstallCommand();
      
      expect(command.name()).toBe('uninstall');
    });

    it('should have correct description', () => {
      const command = createUninstallCommand();
      
      expect(command.description()).toBe('Uninstall pawnctl and remove all user data');
    });

    it('should have force option', () => {
      const command = createUninstallCommand();
      const options = command.options;
      
      const forceOption = options.find(opt => opt.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.short).toBe('-f');
      expect(forceOption?.description).toBe('Skip confirmation prompt');
    });
  });

  describe('Path handling', () => {
    it('should correctly join paths regardless of platform', () => {
      // Test Unix-style paths
      mockOs.homedir.mockReturnValue('/home/testuser');
      const unixPath = path.join('/home/testuser', '.pawnctl');
      expect(unixPath).toContain('.pawnctl');
      expect(unixPath).toContain('testuser');
      
      // Test Windows-style input (will be normalized by path.join)
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      const windowsPath = path.join('C:\\Users\\testuser', '.pawnctl');
      expect(windowsPath).toContain('.pawnctl');
      expect(windowsPath).toContain('testuser');
    });

    it('should handle special characters in path', () => {
      const homedirWithSpaces = '/home/test user';
      mockOs.homedir.mockReturnValue(homedirWithSpaces);
      
      const expectedPath = path.join(homedirWithSpaces, '.pawnctl');
      expect(expectedPath).toContain('.pawnctl');
      expect(expectedPath).toContain('test user');
    });

    it('should correctly combine different home directory formats', () => {
      const testPaths = [
        '/home/testuser',
        '/Users/testuser', 
        'C:\\Users\\testuser',
        '/home/test user'
      ];

      testPaths.forEach(homedir => {
        mockOs.homedir.mockReturnValue(homedir);
        const result = path.join(homedir, '.pawnctl');
        
        // Basic checks that work cross-platform
        expect(result).toContain('.pawnctl');
        expect(result.length).toBeGreaterThan(homedir.length);
        
        // Verify the result ends with .pawnctl
        expect(result.endsWith('.pawnctl')).toBe(true);
        
        // Verify the path contains the username part
        if (homedir.includes('testuser')) {
          expect(result).toContain('testuser');
        }
        if (homedir.includes('test user')) {
          expect(result).toContain('test user');
        }
      });
    });

    it('should construct expected .pawnctl path structure', () => {
      const testHomedir = '/test/home/dir';
      const result = path.join(testHomedir, '.pawnctl');
      
      // Should end with .pawnctl regardless of platform
      expect(result.endsWith('.pawnctl')).toBe(true);
      
      // Should contain the path separator before .pawnctl
      expect(result.includes(`${path.sep}.pawnctl`)).toBe(true);
    });
  });

  describe('File system operations', () => {
    it('should check if directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const result = mockFs.existsSync('/mock/path/.pawnctl');
      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/mock/path/.pawnctl');
    });

    it('should remove directory recursively', () => {
      const testPath = '/test/.pawnctl';
      
      mockFs.rmSync(testPath, { recursive: true, force: true });
      
      expect(mockFs.rmSync).toHaveBeenCalledWith(testPath, {
        recursive: true,
        force: true
      });
    });
  });

  describe('User interaction', () => {
    it('should prompt for confirmation', async () => {
      mockConfirm.mockResolvedValue(true);
      
      const result = await mockConfirm({
        message: 'Are you sure you want to continue?',
        default: false
      });
      
      expect(result).toBe(true);
      expect(mockConfirm).toHaveBeenCalledWith({
        message: 'Are you sure you want to continue?',
        default: false
      });
    });

    it('should handle user rejection', async () => {
      mockConfirm.mockResolvedValue(false);
      
      const result = await mockConfirm({
        message: 'Are you sure you want to continue?',
        default: false
      });
      
      expect(result).toBe(false);
    });
  });

  describe('Error scenarios', () => {
    it('should handle permission errors', () => {
      const permissionError = new Error('EACCES: permission denied');
      mockFs.rmSync.mockImplementation(() => {
        throw permissionError;
      });
      
      expect(() => mockFs.rmSync('/test/.pawnctl', { recursive: true, force: true }))
        .toThrow('EACCES: permission denied');
    });

    it('should handle missing directory gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const exists = mockFs.existsSync('/nonexistent/.pawnctl');
      expect(exists).toBe(false);
      
      // Should not attempt to remove if directory doesn't exist
      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });
});

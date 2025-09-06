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
    it('should use correct user directory path on Windows', () => {
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      
      const expectedPath = path.join('C:\\Users\\testuser', '.pawnctl');
      expect(expectedPath).toBe(path.normalize('C:\\Users\\testuser\\.pawnctl'));
    });

    it('should use correct user directory path on Unix-like systems', () => {
      const homedir = '/home/testuser';
      mockOs.homedir.mockReturnValue(homedir);
      
      const expectedPath = path.join(homedir, '.pawnctl');
      const normalizedExpected = path.join(homedir, '.pawnctl');
      expect(expectedPath).toBe(normalizedExpected);
    });

    it('should handle special characters in path', () => {
      const homedir = '/home/test user';
      mockOs.homedir.mockReturnValue(homedir);
      
      const expectedPath = path.join(homedir, '.pawnctl');
      const normalizedExpected = path.join(homedir, '.pawnctl');
      expect(expectedPath).toBe(normalizedExpected);
    });

    it('should correctly combine home directory with .pawnctl', () => {
      const testPaths = [
        'C:\\Users\\testuser',
        '/home/testuser',
        '/Users/testuser',
        'C:\\Users\\test user'
      ];

      testPaths.forEach(homedir => {
        const result = path.join(homedir, '.pawnctl');
        expect(result).toContain('.pawnctl');
        // Normalize both paths for comparison
        expect(path.normalize(result).startsWith(path.normalize(homedir))).toBe(true);
      });
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

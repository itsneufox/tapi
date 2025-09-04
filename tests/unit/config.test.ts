import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/utils/config';
import { createTempDir } from '../setup';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let originalHomedir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    // Save original environment variables
    originalHomedir = process.env.HOME || process.env.USERPROFILE || '';
    
    // Mock os.homedir to use our temp directory
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
    
    // Also mock os.homedir function directly
    const os = require('os');
    jest.spyOn(os, 'homedir').mockReturnValue(tempDir);
    
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Restore original homedir
    if (originalHomedir) {
      process.env.HOME = originalHomedir;
      process.env.USERPROFILE = originalHomedir;
    } else {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
    
    // Restore mocked functions
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    test('should create config manager with empty config', () => {
      expect(configManager.getFullConfig()).toEqual({});
    });

    test('should load existing config file', () => {
      const configPath = path.join(tempDir, '.pawnctl', 'config.json');
      const testConfig = {
        defaultAuthor: 'Test Author',
        editor: 'VS Code',
        setupComplete: true
      };
      
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(testConfig));
      const manager = new ConfigManager();
      
      expect(manager.getFullConfig()).toEqual(testConfig);
    });
  });

  describe('author management', () => {
    test('should set and get default author', () => {
      configManager.setDefaultAuthor('John Doe');
      expect(configManager.getDefaultAuthor()).toBe('John Doe');
    });

    test('should return undefined for unset author', () => {
      expect(configManager.getDefaultAuthor()).toBeUndefined();
    });
  });

  describe('editor management', () => {
    test('should set and get editor preference', () => {
      configManager.setEditor('VS Code');
      expect(configManager.getEditor()).toBe('VS Code');
    });

    test('should handle different editor types', () => {
      const editors: Array<'VS Code' | 'Sublime Text' | 'Other/None'> = [
        'VS Code',
        'Sublime Text', 
        'Other/None'
      ];

      editors.forEach(editor => {
        configManager.setEditor(editor);
        expect(configManager.getEditor()).toBe(editor);
      });
    });
  });

  describe('GitHub integration', () => {
    test('should set and get GitHub token', () => {
      const token = 'ghp_test_token_123';
      configManager.setGitHubToken(token);
      expect(configManager.getGitHubToken()).toBe(token);
    });

    test('should prioritize environment variable over config', () => {
      // Set config token
      configManager.setGitHubToken('config_token');
      
      // Set environment variable
      process.env.NPT_GITHUB_TOKEN = 'env_token';
      
      expect(configManager.getGitHubToken()).toBe('env_token');
      
      // Clean up
      delete process.env.NPT_GITHUB_TOKEN;
    });
  });

  describe('setup completion', () => {
    test('should track setup completion', () => {
      expect(configManager.isSetupComplete()).toBe(false);
      
      configManager.setSetupComplete(true);
      expect(configManager.isSetupComplete()).toBe(true);
    });
  });

  describe('persistence', () => {
    test('should save and load config to/from file', () => {
      configManager.setDefaultAuthor('Test Author');
      configManager.setEditor('VS Code');
      configManager.setSetupComplete(true);

      // Create new instance to test loading
      const newManager = new ConfigManager();
      
      expect(newManager.getDefaultAuthor()).toBe('Test Author');
      expect(newManager.getEditor()).toBe('VS Code');
      expect(newManager.isSetupComplete()).toBe(true);
    });

    test('should handle corrupted config files gracefully', () => {
      const configPath = path.join(tempDir, '.pawnctl', 'config.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, '{ invalid json }');
      
      // Should not throw and should start with empty config
      expect(() => {
        const manager = new ConfigManager();
        expect(manager.getFullConfig()).toEqual({});
      }).not.toThrow();
    });
  });

  describe('reset functionality', () => {
    test('should reset all configuration to defaults', () => {
      configManager.setDefaultAuthor('Test Author');
      configManager.setEditor('VS Code');
      configManager.setGitHubToken('test_token');
      configManager.setSetupComplete(true);

      configManager.reset();

      expect(configManager.getDefaultAuthor()).toBeUndefined();
      expect(configManager.getEditor()).toBeUndefined();
      expect(configManager.getGitHubToken()).toBeUndefined();
      expect(configManager.isSetupComplete()).toBe(false);
    });
  });
});

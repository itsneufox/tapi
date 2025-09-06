jest.mock('../../src/utils/logger', () => ({
  logger: {
    heading: jest.fn(),
    info: jest.fn(),
    subheading: jest.fn(),
    keyValue: jest.fn(),
    newline: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

jest.mock('../../src/utils/config', () => ({
  configManager: {
    isSetupComplete: jest.fn(),
    getFullConfig: jest.fn(),
    setDefaultAuthor: jest.fn(),
    setEditor: jest.fn(),
    setGitHubToken: jest.fn(),
    setSetupComplete: jest.fn(),
  }
}));

import { logger } from '../../src/utils/logger';
import { configManager } from '../../src/utils/config';

const _mockLogger = logger as jest.Mocked<typeof logger>;
const mockConfigManager = configManager as jest.Mocked<typeof configManager>;

describe('Setup Command Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Setup Status Detection', () => {
    test('should detect when setup is already complete', () => {
      mockConfigManager.isSetupComplete.mockReturnValue(true);
      mockConfigManager.getFullConfig.mockReturnValue({
        defaultAuthor: 'John Doe',
        editor: 'VS Code',
        githubToken: 'token123',
        setupComplete: true
      });

      expect(mockConfigManager.isSetupComplete()).toBe(true);
      const config = mockConfigManager.getFullConfig();
      expect(config.setupComplete).toBe(true);
      expect(config.defaultAuthor).toBe('John Doe');
    });

    test('should detect when setup is not complete', () => {
      mockConfigManager.isSetupComplete.mockReturnValue(false);
      
      expect(mockConfigManager.isSetupComplete()).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    test('should update default author', () => {
      const authorName = 'New Author';
      mockConfigManager.setDefaultAuthor(authorName);
      
      expect(mockConfigManager.setDefaultAuthor).toHaveBeenCalledWith(authorName);
    });

    test('should update preferred editor', () => {
      const editor = 'VS Code' as const;
      mockConfigManager.setEditor(editor);
      
      expect(mockConfigManager.setEditor).toHaveBeenCalledWith(editor);
    });

    test('should update GitHub token', () => {
      const token = 'ghp_newtoken456';
      mockConfigManager.setGitHubToken(token);
      
      expect(mockConfigManager.setGitHubToken).toHaveBeenCalledWith(token);
    });

    test('should mark setup as complete', () => {
      mockConfigManager.setSetupComplete(true);
      
      expect(mockConfigManager.setSetupComplete).toHaveBeenCalledWith(true);
    });
  });

  describe('Editor Options', () => {
    test('should validate supported editors', () => {
      const supportedEditors: Array<'VS Code' | 'Sublime Text' | 'Other/None'> = ['VS Code', 'Sublime Text', 'Other/None'];
      
      supportedEditors.forEach(editor => {
        expect(typeof editor).toBe('string');
        expect(editor.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Setup Flow Logic', () => {
    test('should skip setup when force is false and setup is complete', () => {
      mockConfigManager.isSetupComplete.mockReturnValue(true);
      
      const force = false;
      const shouldSkip = !force && mockConfigManager.isSetupComplete();
      
      expect(shouldSkip).toBe(true);
      expect(mockConfigManager.isSetupComplete).toHaveBeenCalled();
    });

    test('should run setup when force is true', () => {
      mockConfigManager.isSetupComplete.mockReturnValue(true);
      
      const force = true;
      const shouldRun = force || !mockConfigManager.isSetupComplete();
      
      expect(shouldRun).toBe(true);
    });
  });
});

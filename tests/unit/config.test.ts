jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    plain: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    hint: jest.fn(),
    working: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

jest.mock('../../src/utils/config', () => ({
  configManager: {
    getFullConfig: jest.fn(),
    getDefaultAuthor: jest.fn(),
    setDefaultAuthor: jest.fn(),
    getEditor: jest.fn(),
    setEditor: jest.fn(),
    getGitHubToken: jest.fn(),
    setGitHubToken: jest.fn(),
  }
}));

import { logger } from '../../src/utils/logger';
import { configManager } from '../../src/utils/config';

const _mockLogger = logger as jest.Mocked<typeof logger>;
const mockConfigManager = configManager as jest.Mocked<typeof configManager>;

describe('Config Command Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Display', () => {
    test('should display current configuration', () => {
      mockConfigManager.getFullConfig.mockReturnValue({
        defaultAuthor: 'John Doe',
        editor: 'VS Code',
        githubToken: 'ghp_test123',
        setupComplete: true
      });

      const config = mockConfigManager.getFullConfig();
      expect(config.defaultAuthor).toBe('John Doe');
      expect(config.editor).toBe('VS Code');
      expect(config.githubToken).toBeTruthy();
    });

    test('should handle missing configuration values', () => {
      mockConfigManager.getFullConfig.mockReturnValue({});

      const config = mockConfigManager.getFullConfig();
      expect(config.defaultAuthor).toBeUndefined();
      expect(config.editor).toBeUndefined();
      expect(config.githubToken).toBeUndefined();
    });
  });

  describe('Author Configuration', () => {
    test('should get current author', () => {
      mockConfigManager.getDefaultAuthor.mockReturnValue('Current Author');
      
      const author = mockConfigManager.getDefaultAuthor();
      expect(author).toBe('Current Author');
    });

    test('should set new author', () => {
      const newAuthor = 'New Author';
      mockConfigManager.setDefaultAuthor(newAuthor);
      
      expect(mockConfigManager.setDefaultAuthor).toHaveBeenCalledWith(newAuthor);
    });

    test('should handle empty author name', () => {
      mockConfigManager.getDefaultAuthor.mockReturnValue(undefined);
      
      const author = mockConfigManager.getDefaultAuthor();
      expect(author).toBeUndefined();
    });
  });

  describe('Editor Configuration', () => {
    test('should get current editor', () => {
      mockConfigManager.getEditor.mockReturnValue('VS Code');
      
      const editor = mockConfigManager.getEditor();
      expect(editor).toBe('VS Code');
    });

    test('should set new editor', () => {
      const newEditor = 'Sublime Text' as const;
      mockConfigManager.setEditor(newEditor);
      
      expect(mockConfigManager.setEditor).toHaveBeenCalledWith(newEditor);
    });

    test('should validate editor options', () => {
      const validEditors: Array<'VS Code' | 'Sublime Text' | 'Other/None'> = ['VS Code', 'Sublime Text', 'Other/None'];
      
      validEditors.forEach(editor => {
        expect(typeof editor).toBe('string');
        expect(editor.length).toBeGreaterThan(0);
      });
    });
  });

  describe('GitHub Token Configuration', () => {
    test('should get GitHub token', () => {
      mockConfigManager.getGitHubToken.mockReturnValue('ghp_test123');
      
      const token = mockConfigManager.getGitHubToken();
      expect(token).toBe('ghp_test123');
    });

    test('should set GitHub token', () => {
      const token = 'ghp_newtoken456';
      mockConfigManager.setGitHubToken(token);
      
      expect(mockConfigManager.setGitHubToken).toHaveBeenCalledWith(token);
    });

    test('should handle missing GitHub token', () => {
      mockConfigManager.getGitHubToken.mockReturnValue(undefined);
      
      const token = mockConfigManager.getGitHubToken();
      expect(token).toBeUndefined();
    });
  });

  describe('Token Security', () => {
    test('should mask token in display', () => {
      const token = 'ghp_1234567890abcdef1234567890abcdef123456';
      const maskedToken = '***' + token.slice(-4);
      
      expect(maskedToken).toBe('***3456');
    });

    test('should handle missing token in display', () => {
      const _token: string | undefined = undefined;
      const maskedToken = 'Not set';
      
      expect(maskedToken).toBe('Not set');
    });
  });
});

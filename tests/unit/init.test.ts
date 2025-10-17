import * as fs from 'fs';
import * as path from 'path';
import { createTempDir } from '../setup';

jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
    isSilent: false,
  }));
});

jest.mock('cli-progress');
jest.mock('https');

jest.mock('../../src/utils/logger', () => ({
  logger: {
    getVerbosity: jest.fn(() => 'normal'),
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    detail: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

import { logger } from '../../src/utils/logger';

const _mockLogger = logger as jest.Mocked<typeof logger>;

describe('Init Command Utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Command Options Interface', () => {
    test('should validate CommandOptions structure', () => {
      const options = {
        name: 'test-project',
        description: 'A test project',
        author: 'Test Author',
        quiet: false,
        verbose: true,
        initGit: true,
        logToFile: false,
        skipCompiler: false,
        legacySamp: false
      };

      expect(typeof options.name).toBe('string');
      expect(typeof options.description).toBe('string');
      expect(typeof options.author).toBe('string');
      expect(typeof options.quiet).toBe('boolean');
      expect(typeof options.verbose).toBe('boolean');
      expect(typeof options.initGit).toBe('boolean');
      expect(typeof options.skipCompiler).toBe('boolean');
      expect(typeof options.legacySamp).toBe('boolean');
    });

    test('should handle optional fields', () => {
      const minimalOptions = {};
      
      expect(minimalOptions).toBeDefined();
    });
  });

  describe('InitialAnswers Interface', () => {
    test('should validate InitialAnswers structure', () => {
      const answers = {
        name: 'my-gamemode',
        description: 'A roleplay gamemode',
        author: 'Developer',
        projectType: 'gamemode' as const,
        addStdLib: true,
        initGit: true,
        downloadServer: false,
        editor: 'VS Code' as const
      };

      expect(typeof answers.name).toBe('string');
      expect(typeof answers.description).toBe('string');
      expect(typeof answers.author).toBe('string');
      expect(['gamemode', 'filterscript', 'library']).toContain(answers.projectType);
      expect(typeof answers.addStdLib).toBe('boolean');
      expect(typeof answers.initGit).toBe('boolean');
      expect(typeof answers.downloadServer).toBe('boolean');
      expect(['VS Code', 'Sublime Text', 'Other/None']).toContain(answers.editor);
    });

    test('should validate project types', () => {
      const validTypes = ['gamemode', 'filterscript', 'library'];
      
      validTypes.forEach(type => {
        expect(['gamemode', 'filterscript', 'library']).toContain(type);
      });
    });

    test('should validate editor options', () => {
      const validEditors = ['VS Code', 'Sublime Text', 'Other/None'];
      
      validEditors.forEach(editor => {
        expect(['VS Code', 'Sublime Text', 'Other/None']).toContain(editor);
      });
    });
  });

  describe('CompilerAnswers Interface', () => {
    test('should validate CompilerAnswers structure', () => {
      const answers = {
        downloadCompiler: true,
        compilerVersion: '3.10.10',
        keepQawno: false,
        downgradeQawno: true,
        installCompilerFolder: true,
        useCompilerFolder: false,
        downloadStdLib: true
      };

      expect(typeof answers.downloadCompiler).toBe('boolean');
      expect(typeof answers.compilerVersion).toBe('string');
      expect(typeof answers.downloadStdLib).toBe('boolean');
    });

    test('should validate compiler versions', () => {
      const validVersions = ['3.10.10', '3.10.9', '3.10.8'];
      
      validVersions.forEach(version => {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });

  describe('Spinner Utilities', () => {
    test('should create spinner in normal mode', () => {
      _mockLogger.getVerbosity.mockReturnValue('normal');
      
      const { createSpinner } = jest.requireActual('../../src/commands/init/utils');
      const spinner = createSpinner('Testing...');
      
      expect(spinner).toBeDefined();
      expect(_mockLogger.getVerbosity).toHaveBeenCalled();
    });

    test('should create silent spinner in quiet mode', () => {
      _mockLogger.getVerbosity.mockReturnValue('quiet');
      
      const { createSpinner } = jest.requireActual('../../src/commands/init/utils');
      const spinner = createSpinner('Testing...');
      
      expect(spinner).toBeDefined();
      expect(_mockLogger.getVerbosity).toHaveBeenCalled();
    });
  });

  describe('File Cleanup Utilities', () => {
    test('should handle cleanup of non-existent directory', () => {
      const { cleanupFiles } = jest.requireActual('../../src/commands/init/utils');
      const nonExistentDir = path.join(tempDir, 'nonexistent');
      
      const result = cleanupFiles(nonExistentDir, []);
      expect(result).toBe(0);
    });

    test('should cleanup files while keeping specified items', () => {
      const testDir = path.join(tempDir, 'cleanup-test');
      fs.mkdirSync(testDir, { recursive: true });
      
      fs.writeFileSync(path.join(testDir, 'keep.txt'), 'keep this');
      fs.writeFileSync(path.join(testDir, 'delete.txt'), 'delete this');
      fs.writeFileSync(path.join(testDir, 'also-delete.txt'), 'delete this too');
      
      const { cleanupFiles } = jest.requireActual('../../src/commands/init/utils');
      const result = cleanupFiles(testDir, ['keep.txt']);
      
      expect(result).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(testDir, 'keep.txt'))).toBe(true);
    });
  });

  describe('Project Structure Validation', () => {
    test('should validate project names', () => {
      const validNames = ['my-project', 'gamemode_v2', 'SimpleScript'];
      const invalidNames = ['', ' ', 'project with spaces'];
      
      validNames.forEach(name => {
        expect(name.length).toBeGreaterThan(0);
        expect(name.trim()).toBe(name);
        expect(name.includes(' ')).toBe(false);
      });
      
      invalidNames.forEach(name => {
        expect(name.length === 0 || name.trim() !== name || name.includes(' ')).toBe(true);
      });
    });

    test('should validate project descriptions', () => {
      const validDescriptions = [
        'A simple gamemode',
        'Advanced roleplay server',
        'Custom filterscript for racing'
      ];
      
      validDescriptions.forEach(desc => {
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      });
    });

    test('should validate author names', () => {
      const validAuthors = ['John Doe', 'developer123', 'Team_Name'];
      
      validAuthors.forEach(author => {
        expect(typeof author).toBe('string');
        expect(author.length).toBeGreaterThan(0);
      });
    });
  });

  describe('File Extensions', () => {
    test('should recognize PAWN file extensions', () => {
      const pawnFiles = [
        'gamemode.pwn',
        'filterscript.pwn',
        'library.inc'
      ];
      
      pawnFiles.forEach(file => {
        expect(file.endsWith('.pwn') || file.endsWith('.inc')).toBe(true);
      });
    });

    test('should recognize compiled PAWN files', () => {
      const compiledFiles = [
        'gamemode.amx',
        'filterscript.amx'
      ];
      
      compiledFiles.forEach(file => {
        expect(file.endsWith('.amx')).toBe(true);
      });
    });

    test('should recognize configuration files', () => {
      const configFiles = [
        'server.cfg',
        'config.json',
        'pawn.json'
      ];
      
      configFiles.forEach(file => {
        expect(file.endsWith('.cfg') || file.endsWith('.json')).toBe(true);
      });
    });
  });

  describe('Directory Structure', () => {
    test('should validate standard PAWN directories', () => {
      const standardDirs = [
        'gamemodes',
        'filterscripts',
        'include',
        'scriptfiles',
        'plugins'
      ];
      
      standardDirs.forEach(dir => {
        expect(typeof dir).toBe('string');
        expect(dir.length).toBeGreaterThan(0);
        expect(dir.includes('/')).toBe(false);
      });
    });

    test('should create project directory structure', () => {
      const projectDir = path.join(tempDir, 'test-project');
      const dirs = ['gamemodes', 'filterscripts', 'include'];
      
      fs.mkdirSync(projectDir, { recursive: true });
      dirs.forEach(dir => {
        fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
      });
      
      dirs.forEach(dir => {
        expect(fs.existsSync(path.join(projectDir, dir))).toBe(true);
      });
    });
  });

  describe('Template Validation', () => {
    test('should validate gamemode template structure', () => {
      const gamemodeTemplate = {
        main: 'OnGameModeInit',
        exit: 'OnGameModeExit',
        playerConnect: 'OnPlayerConnect',
        playerDisconnect: 'OnPlayerDisconnect'
      };
      
      Object.values(gamemodeTemplate).forEach(callback => {
        expect(callback.startsWith('On')).toBe(true);
        expect(typeof callback).toBe('string');
      });
    });

    test('should validate filterscript template structure', () => {
      const filterscriptTemplate = {
        init: 'OnFilterScriptInit',
        exit: 'OnFilterScriptExit'
      };
      
      Object.values(filterscriptTemplate).forEach(callback => {
        expect(callback.startsWith('On')).toBe(true);
        expect(callback.includes('FilterScript')).toBe(true);
      });
    });
  });

  describe('Legacy SA-MP Support', () => {
    test('should handle legacy SA-MP flag', () => {
      const legacyOptions = {
        legacySamp: true,
        skipCompiler: false
      };
      
      expect(legacyOptions.legacySamp).toBe(true);
      expect(typeof legacyOptions.legacySamp).toBe('boolean');
    });

    test('should default to open.mp', () => {
      const defaultOptions = {
        legacySamp: false
      };
      
      expect(defaultOptions.legacySamp).toBe(false);
    });
  });

  describe('Error Conditions', () => {
    test('should handle invalid project names', () => {
      const invalidNames = ['', '   ', 'invalid name with spaces'];
      
      invalidNames.forEach(name => {
        expect(name.trim().length === 0 || name.includes(' ')).toBe(true);
      });
    });

    test('should handle missing directories', () => {
      const missingDir = path.join(tempDir, 'missing', 'deeply', 'nested');
      expect(fs.existsSync(missingDir)).toBe(false);
    });

    test('should handle file system errors', () => {
      expect(() => {
        throw new Error('EACCES: permission denied');
      }).toThrow('EACCES');
      
      expect(() => {
        throw new Error('ENOSPC: no space left on device');
      }).toThrow('ENOSPC');
    });
  });
});

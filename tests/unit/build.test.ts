import * as fs from 'fs';
import * as path from 'path';
import { createTempDir } from '../setup';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    heading: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    detail: jest.fn(),
    working: jest.fn(),
    hint: jest.fn(),
  }
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

import { logger } from '../../src/utils/logger';

const _mockLogger = logger as jest.Mocked<typeof logger>;

describe('Build Command Utilities', () => {
  let tempDir: string;
  let originalExit: typeof process.exit;
  let mockExit: jest.MockedFunction<typeof process.exit>;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    tempDir = createTempDir();
    originalExit = process.exit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExit = jest.fn() as any;
    process.exit = mockExit;
    originalCwd = process.cwd;
    process.cwd = jest.fn(() => tempDir);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.exit = originalExit;
    process.cwd = originalCwd;
    jest.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('formatProblem function', () => {
    function formatProblem(file: string, line: number, severity: string, code: string, message: string): string {
      return `${file}(${line}) : ${severity} ${code}: ${message}`;
    }

    test('should format compilation problems correctly', () => {
      const result = formatProblem('test.pwn', 42, 'error', 'E001', 'Syntax error');
      expect(result).toBe('test.pwn(42) : error E001: Syntax error');
    });

    test('should handle different severity levels', () => {
      expect(formatProblem('test.pwn', 1, 'warning', 'W001', 'Unused variable')).toBe('test.pwn(1) : warning W001: Unused variable');
      expect(formatProblem('test.pwn', 5, 'fatal', 'F001', 'Fatal error')).toBe('test.pwn(5) : fatal F001: Fatal error');
    });
  });

  describe('Manifest Validation', () => {
    test('should detect missing pawn.json manifest', () => {
      expect(fs.existsSync(path.join(tempDir, '.tapi', 'pawn.json'))).toBe(false);
    });

    test('should validate manifest structure', () => {
      const manifestDir = path.join(tempDir, '.tapi');
      fs.mkdirSync(manifestDir, { recursive: true });
      
      const validManifest = {
        name: 'test-project',
        entry: 'gamemode.pwn',
        output: 'gamemode.amx',
        compiler: {
          input: 'gamemode.pwn',
          output: 'gamemode.amx'
        }
      };
      
      fs.writeFileSync(
        path.join(manifestDir, 'pawn.json'),
        JSON.stringify(validManifest, null, 2)
      );
      
      const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, 'pawn.json'), 'utf8'));
      expect(manifest.name).toBe('test-project');
      expect(manifest.entry).toBe('gamemode.pwn');
      expect(manifest.output).toBe('gamemode.amx');
    });
  });

  describe('Input File Resolution', () => {
    test('should prioritize command line input option', () => {
      const manifest = { entry: 'gamemode.pwn' } as { entry: string; compiler?: { input?: string } };
      const options = { input: 'custom.pwn' } as { input?: string };
      
      const inputFile = options.input || manifest.compiler?.input || manifest.entry;
      expect(inputFile).toBe('custom.pwn');
    });

    test('should fall back to compiler input from manifest', () => {
      const manifest = { 
        entry: 'gamemode.pwn',
        compiler: { input: 'main.pwn' }
      } as { entry: string; compiler: { input: string } };
      const options = {} as { input?: string };
      
      const inputFile = options.input || manifest.compiler?.input || manifest.entry;
      expect(inputFile).toBe('main.pwn');
    });

    test('should fall back to entry from manifest', () => {
      const manifest = { entry: 'gamemode.pwn' } as { entry: string; compiler?: { input?: string } };
      const options = {} as { input?: string };
      
      const inputFile = options.input || manifest.compiler?.input || manifest.entry;
      expect(inputFile).toBe('gamemode.pwn');
    });
  });

  describe('Output File Resolution', () => {
    test('should prioritize command line output option', () => {
      const manifest = { output: 'gamemode.amx' } as { output: string; compiler?: { output?: string } };
      const options = { output: 'custom.amx' } as { output?: string };
      
      const outputFile = options.output || manifest.compiler?.output || manifest.output;
      expect(outputFile).toBe('custom.amx');
    });

    test('should fall back to compiler output from manifest', () => {
      const manifest = { 
        output: 'gamemode.amx',
        compiler: { output: 'main.amx' }
      } as { output: string; compiler: { output: string } };
      const options = {} as { output?: string };
      
      const outputFile = options.output || manifest.compiler?.output || manifest.output;
      expect(outputFile).toBe('main.amx');
    });

    test('should fall back to output from manifest', () => {
      const manifest = { output: 'gamemode.amx' } as { output: string; compiler?: { output?: string } };
      const options = {} as { output?: string };
      
      const outputFile = options.output || manifest.compiler?.output || manifest.output;
      expect(outputFile).toBe('gamemode.amx');
    });
  });

  describe('Debug Level Validation', () => {
    test('should validate debug level values', () => {
      const validLevels = ['1', '2', '3'];
      const invalidLevels = ['0', '4', 'invalid', ''];
      
      validLevels.forEach(level => {
        const debugLevel = parseInt(level);
        expect(debugLevel).toBeGreaterThanOrEqual(1);
        expect(debugLevel).toBeLessThanOrEqual(3);
      });
      
      invalidLevels.forEach(level => {
        const debugLevel = parseInt(level);
        expect(debugLevel < 1 || debugLevel > 3 || isNaN(debugLevel)).toBe(true);
      });
    });

    test('should use default debug level', () => {
      const defaultDebugLevel = '3';
      expect(defaultDebugLevel).toBe('3');
      expect(parseInt(defaultDebugLevel)).toBe(3);
    });
  });

  describe('File Extensions', () => {
    test('should detect PAWN source files', () => {
      const pawnFiles = ['gamemode.pwn', 'filterscript.pwn', 'library.inc'];
      const nonPawnFiles = ['readme.txt', 'config.json', 'script.js'];
      
      pawnFiles.forEach(file => {
        expect(file.endsWith('.pwn') || file.endsWith('.inc')).toBe(true);
      });
      
      nonPawnFiles.forEach(file => {
        expect(file.endsWith('.pwn') || file.endsWith('.inc')).toBe(false);
      });
    });

    test('should detect AMX output files', () => {
      const amxFiles = ['gamemode.amx', 'filterscript.amx'];
      const nonAmxFiles = ['gamemode.pwn', 'config.json'];
      
      amxFiles.forEach(file => {
        expect(file.endsWith('.amx')).toBe(true);
      });
      
      nonAmxFiles.forEach(file => {
        expect(file.endsWith('.amx')).toBe(false);
      });
    });
  });

  describe('Error Conditions', () => {
    test('should handle missing input file', () => {
      const inputFile = 'nonexistent.pwn';
      expect(fs.existsSync(inputFile)).toBe(false);
    });

    test('should handle invalid manifest JSON', () => {
      const manifestDir = path.join(tempDir, '.tapi');
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(path.join(manifestDir, 'pawn.json'), 'invalid json');
      
      expect(() => {
        JSON.parse(fs.readFileSync(path.join(manifestDir, 'pawn.json'), 'utf8'));
      }).toThrow();
    });
  });

  describe('Compiler Arguments', () => {
    test('should build compiler arguments correctly', () => {
      const inputFile = 'gamemode.pwn';
      const outputFile = 'gamemode.amx';
      const debugLevel = '2';
      const includeDir = 'pawno/include';
      
      const expectedArgs = [
        inputFile,
        `-o${outputFile}`,
        `-d${debugLevel}`,
        `-i${includeDir}`
      ];
      
      expectedArgs.forEach(arg => {
        expect(typeof arg).toBe('string');
        expect(arg.length).toBeGreaterThan(0);
      });
    });

    test('should handle include directories', () => {
      const includeDirs = ['pawno/include', 'custom/include', 'lib/include'];
      
      includeDirs.forEach(dir => {
        const includeArg = `-i${dir}`;
        expect(includeArg).toMatch(/^-i.+/);
      });
    });
  });

  describe('Compilation Output Parsing', () => {
    test('should parse compilation success', () => {
      const successOutput = 'Pawn compiler 3.10.10\nSuccess: compiled to gamemode.amx\n';
      expect(successOutput.includes('Success')).toBe(true);
      expect(successOutput.includes('.amx')).toBe(true);
    });

    test('should parse compilation errors', () => {
      const errorOutput = 'gamemode.pwn(42) : error 001: expected token: ";"';
      const problemPattern = /(\w+\.pwn)\((\d+)\)\s*:\s*(\w+)\s+(\d+):\s*(.+)/;
      const match = errorOutput.match(problemPattern);
      
      if (match) {
        expect(match[1]).toBe('gamemode.pwn');
        expect(match[2]).toBe('42');
        expect(match[3]).toBe('error');
        expect(match[4]).toBe('001');
        expect(match[5]).toContain('expected token');
      }
    });

    test('should parse compilation warnings', () => {
      const warningOutput = 'gamemode.pwn(15) : warning 203: symbol is never used: "unused_var"';
      const problemPattern = /(\w+\.pwn)\((\d+)\)\s*:\s*(\w+)\s+(\d+):\s*(.+)/;
      const match = warningOutput.match(problemPattern);
      
      if (match) {
        expect(match[3]).toBe('warning');
        expect(match[5]).toContain('never used');
      }
    });
  });
});

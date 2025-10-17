import * as fs from 'fs';
import * as path from 'path';
import { generatePackageManifest, loadManifest, updateManifest } from '../../src/core/manifest';
import { createTempDir } from '../setup';

describe('Package Manifest Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    process.chdir(tempDir);
  });

  describe('generatePackageManifest', () => {
    test('should create a complete manifest file', async () => {
      const options = {
        name: 'test-gamemode',
        description: 'A test gamemode',
        author: 'Test Author',
        projectType: 'gamemode' as const,
        addStdLib: true,
        legacySamp: false
      };

      await generatePackageManifest(options);

      const manifestPath = path.join(tempDir, '.tapi', 'pawn.json');
      expect(manifestPath).toExistAsFile();

      const content = fs.readFileSync(manifestPath, 'utf8');
      expect(content).toBeValidJSON();

      const manifest = JSON.parse(content);
      expect(manifest.name).toBe('test-gamemode');
      expect(manifest.description).toBe('A test gamemode');
      expect(manifest.author).toBe('Test Author');
      expect(manifest.entry).toBe('gamemodes/test-gamemode.pwn');
    });

    test('should create manifest for different project types', async () => {
      const testCases = [
        { type: 'gamemode' as const, expectedEntry: 'gamemodes/test.pwn' },
        { type: 'filterscript' as const, expectedEntry: 'filterscripts/test.pwn' },
        { type: 'library' as const, expectedEntry: 'includes/test.inc' }
      ];

      for (const testCase of testCases) {
        const options = {
          name: 'test',
          description: 'Test project',
          author: 'Test Author',
          projectType: testCase.type,
          addStdLib: false,
          legacySamp: false
        };

        await generatePackageManifest(options);

        const manifest = await loadManifest();
        expect(manifest?.entry).toBe(testCase.expectedEntry);

        // Clean up for next iteration
        fs.rmSync(path.join(tempDir, '.tapi'), { recursive: true, force: true });
      }
    });

    test('should handle legacy SA-MP configuration', async () => {
      const options = {
        name: 'legacy-test',
        description: 'Legacy SA-MP test',
        author: 'Test Author',
        projectType: 'gamemode' as const,
        addStdLib: false,
        legacySamp: true
      };

      await generatePackageManifest(options);

      const manifest = await loadManifest();
      // Legacy SA-MP still uses the same includes array structure
      expect(manifest?.compiler?.includes).toEqual(['includes', 'gamemodes']);
    });
  });

  describe('readPackageManifest', () => {
    test('should return null when no manifest exists', async () => {
      const manifest = await loadManifest();
      expect(manifest).toBeNull();
    });

    test('should read existing manifest correctly', async () => {
      // Create a manifest first
      await generatePackageManifest({
        name: 'read-test',
        description: 'Read test',
        author: 'Test Author',
        projectType: 'gamemode',
        addStdLib: true,
        legacySamp: false
      });

      const manifest = await loadManifest();
      expect(manifest).not.toBeNull();
      expect(manifest?.name).toBe('read-test');
      expect(manifest?.description).toBe('Read test');
    });

    test('should handle corrupted manifest files', async () => {
      // Create .tapi directory and invalid manifest
      const tapiDir = path.join(tempDir, '.tapi');
      fs.mkdirSync(tapiDir, { recursive: true });
      fs.writeFileSync(path.join(tapiDir, 'pawn.json'), '{ invalid json');

      const manifest = await loadManifest();
      expect(manifest).toBeNull();
    });
  });

  describe('updatePackageManifest', () => {
    test('should update existing manifest', async () => {
      // Create initial manifest
      await generatePackageManifest({
        name: 'update-test',
        description: 'Original description',
        author: 'Original Author',
        projectType: 'gamemode',
        addStdLib: true,
        legacySamp: false
      });

      // Update manifest
      const result = await updateManifest({
        description: 'Updated description',
        version: '2.0.0'
      });

      expect(result).toBe(true);

      // Verify update
      const manifest = await loadManifest();
      expect(manifest?.description).toBe('Updated description');
      expect(manifest?.version).toBe('2.0.0');
      expect(manifest?.name).toBe('update-test'); // Should preserve original
    });

    test('should return false when no manifest exists', async () => {
      const result = await updateManifest({
        description: 'New description'
      });

      expect(result).toBe(false);
    });
  });

  describe('directory structure', () => {
    test('should create .tapi directory if it does not exist', async () => {
      const tapiDir = path.join(tempDir, '.tapi');
      expect(fs.existsSync(tapiDir)).toBe(false);

      await generatePackageManifest({
        name: 'dir-test',
        description: 'Directory test',
        author: 'Test Author',
        projectType: 'gamemode',
        addStdLib: false,
        legacySamp: false
      });

      expect(tapiDir).toExistAsDirectory();
    });
  });
});

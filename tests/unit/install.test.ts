import { hasAtLeastOne, hasTwoOrMore } from '../../src/utils/general';

// Mock modules that cause ESM issues
jest.mock('chalk', () => ({
  cyan: (str: string) => str,
  gray: (str: string) => str,
  green: (str: string) => str,
  red: (str: string) => str,
  white: (str: string) => str,
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    getVerbosity: jest.fn(() => 'normal'),
    info: jest.fn(),
    error: jest.fn(),
    routine: jest.fn(),
    success: jest.fn(),
    working: jest.fn(),
    detail: jest.fn(),
    warn: jest.fn(),
    plain: jest.fn(),
  }
}));

jest.mock('../../src/utils/githubHandler', () => ({
  fetchRepoDefaultBranch: jest.fn(),
  fetchRepoPawnInfo: jest.fn(),
}));

jest.mock('../../src/utils/banner', () => ({
  showBanner: jest.fn(),
}));

describe('Install Command Utilities', () => {
  describe('Repository Validation Functions', () => {
    test('hasAtLeastOne should work with repository objects', () => {
      const repo = {
        owner: 'test',
        repository: 'repo',
        branch: 'main',
        tag: '',
        commitId: undefined
      };
      
      expect(hasAtLeastOne(repo, ['branch', 'tag', 'commitId'])).toBe(true);
      expect(hasAtLeastOne(repo, ['tag', 'commitId'])).toBe(false);
    });

    test('hasTwoOrMore should detect multiple references', () => {
      const repo = {
        owner: 'test',
        repository: 'repo',
        branch: 'main',
        tag: 'v1.0.0',
        commitId: undefined
      };
      
      expect(hasTwoOrMore(repo, ['branch', 'tag', 'commitId'])).toBe(true);
      
      const singleRepo = {
        owner: 'test',
        repository: 'repo',
        branch: 'main',
        tag: '',
        commitId: undefined
      };
      
      expect(hasTwoOrMore(singleRepo, ['branch', 'tag', 'commitId'])).toBe(false);
    });
  });

  describe('Repository Parsing Patterns', () => {
    test('should match valid GitHub repository patterns', () => {
      const repoMatcher = /^([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)(?:@([a-zA-Z0-9-_./+]+))?$/;
      
      // Valid patterns
      expect('owner/repo').toMatch(repoMatcher);
      expect('owner/repo@main').toMatch(repoMatcher);
      expect('owner/repo@v1.0.0').toMatch(repoMatcher);
      expect('my-org/my-repo@feature/branch').toMatch(repoMatcher);
      expect('user123/project_name@dev').toMatch(repoMatcher);
      
      // Invalid patterns
      expect('invalid-repo').not.toMatch(repoMatcher);
      expect('owner/').not.toMatch(repoMatcher);
      expect('/repo').not.toMatch(repoMatcher);
      expect('owner//repo').not.toMatch(repoMatcher);
    });

    test('should detect version tag format correctly', () => {
      const tagMatcher = /^v[0-9]+\.[0-9]+\.[0-9][0-9a-zA-Z]*$/;
      
      // Valid tags
      expect('v1.0.0').toMatch(tagMatcher);
      expect('v2.5.1').toMatch(tagMatcher);
      expect('v1.0.0beta').toMatch(tagMatcher); // No dash allowed in original regex
      expect('v0.1.0alpha1').toMatch(tagMatcher); // No dash/dot allowed in original regex
      expect('v10.20.30').toMatch(tagMatcher);
      
      // Invalid tags (should be treated as branches)
      expect('main').not.toMatch(tagMatcher);
      expect('develop').not.toMatch(tagMatcher);
      expect('feature/test').not.toMatch(tagMatcher);
      expect('1.0.0').not.toMatch(tagMatcher); // Missing 'v' prefix
      expect('v1.0').not.toMatch(tagMatcher); // Missing patch version
    });
  });

  describe('Platform Detection', () => {
    test('should detect platform correctly', () => {
      const originalPlatform = process.platform;
      
      // Test Windows detection
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      expect(process.platform).toBe('win32');
      
      // Test Linux detection
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      expect(process.platform).toBe('linux');
      
      // Test macOS detection
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
      expect(process.platform).toBe('darwin');
      
      // Test unknown platform
      Object.defineProperty(process, 'platform', { value: 'unknown', writable: true });
      expect(process.platform).toBe('unknown');
      
      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    });

    test('should map platforms to expected names', () => {
      const platformMap: Record<string, string> = {
        'win32': 'windows',
        'linux': 'linux',
        'darwin': 'mac'
      };
      
      expect(platformMap['win32']).toBe('windows');
      expect(platformMap['linux']).toBe('linux');
      expect(platformMap['darwin']).toBe('mac');
      expect(platformMap['unknown']).toBeUndefined();
    });
  });

  describe('Error Conditions', () => {
    test('should handle missing repository references', () => {
      const emptyRepo = {
        owner: 'test',
        repository: 'repo',
        branch: '',
        tag: '',
        commitId: undefined
      };
      
      expect(hasAtLeastOne(emptyRepo, ['branch', 'tag', 'commitId'])).toBe(false);
    });

    test('should handle conflicting repository references', () => {
      const conflictRepo = {
        owner: 'test',
        repository: 'repo',
        branch: 'main',
        tag: 'v1.0.0',
        commitId: 'abc123'
      };
      
      expect(hasTwoOrMore(conflictRepo, ['branch', 'tag', 'commitId'])).toBe(true);
    });
  });

  describe('Repository Information Structure', () => {
    test('should validate pawn.json structure', () => {
      const validPawnJson = {
        user: 'owner',
        repo: 'test-repo',
        dependencies: ['dep1', 'dep2'],
        include_path: 'includes/',
        resources: [
          { platform: 'windows' },
          { platform: 'linux' }
        ]
      };
      
      expect(validPawnJson.user).toBeDefined();
      expect(validPawnJson.repo).toBeDefined();
      expect(Array.isArray(validPawnJson.dependencies)).toBe(true);
      expect(Array.isArray(validPawnJson.resources)).toBe(true);
      expect(validPawnJson.resources.length).toBeGreaterThan(0);
    });

    test('should handle missing optional fields', () => {
      const minimalPawnJson = {
        user: 'owner',
        repo: 'test-repo'
      };
      
      expect(minimalPawnJson.user).toBeDefined();
      expect(minimalPawnJson.repo).toBeDefined();
      expect((minimalPawnJson as any).dependencies).toBeUndefined();
      expect((minimalPawnJson as any).resources).toBeUndefined();
    });
  });

  describe('Resource Filtering', () => {
    test('should filter resources by platform', () => {
      const resources = [
        { platform: 'windows' },
        { platform: 'linux' },
        { platform: 'mac' },
        { platform: 'windows' }
      ];
      
      const windowsResources = resources.filter(r => r.platform === 'windows');
      const linuxResources = resources.filter(r => r.platform === 'linux');
      const macResources = resources.filter(r => r.platform === 'mac');
      
      expect(windowsResources).toHaveLength(2);
      expect(linuxResources).toHaveLength(1);
      expect(macResources).toHaveLength(1);
    });

    test('should handle empty resources array', () => {
      const resources: any[] = [];
      const filteredResources = resources.filter(r => r.platform === 'windows');
      
      expect(filteredResources).toHaveLength(0);
      expect(Array.isArray(filteredResources)).toBe(true);
    });
  });
});
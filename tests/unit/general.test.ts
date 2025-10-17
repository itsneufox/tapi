import { hasAtLeastOne, hasTwoOrMore } from '../../src/utils/general';

describe('General Utilities', () => {
  describe('hasAtLeastOne', () => {
    test('should return true when at least one property has a value', () => {
      const obj = {
        name: 'test',
        version: '',
        author: null,
        description: undefined
      };
      
      expect(hasAtLeastOne(obj, ['name', 'version', 'author'])).toBe(true);
      expect(hasAtLeastOne(obj, ['version', 'author', 'description'])).toBe(false);
      expect(hasAtLeastOne(obj, ['name'])).toBe(true);
    });

    test('should return false when all properties are empty/null/undefined', () => {
      const obj = {
        name: '',
        version: null,
        author: undefined,
        description: ''
      };
      
      expect(hasAtLeastOne(obj, ['name', 'version', 'author', 'description'])).toBe(false);
    });

    test('should return false for empty key array', () => {
      const obj = { name: 'test', version: '1.0.0' };
      expect(hasAtLeastOne(obj, [])).toBe(false);
    });

    test('should handle non-existent properties', () => {
      const obj = { name: 'test' };
      expect(hasAtLeastOne(obj, ['name', 'nonexistent' as keyof typeof obj])).toBe(true);
      expect(hasAtLeastOne(obj, ['nonexistent' as keyof typeof obj])).toBe(false);
    });

    test('should treat zero and false as valid values', () => {
      const obj = {
        count: 0,
        enabled: false,
        empty: '',
        nothing: null
      };
      
      expect(hasAtLeastOne(obj, ['count', 'empty'])).toBe(true);
      expect(hasAtLeastOne(obj, ['enabled', 'nothing'])).toBe(true);
      expect(hasAtLeastOne(obj, ['empty', 'nothing'])).toBe(false);
    });
  });

  describe('hasTwoOrMore', () => {
    test('should return true when two or more properties have values', () => {
      const obj = {
        name: 'test',
        version: '1.0.0',
        author: '',
        description: null
      };
      
      expect(hasTwoOrMore(obj, ['name', 'version', 'author'])).toBe(true);
      expect(hasTwoOrMore(obj, ['name', 'version'])).toBe(true);
      expect(hasTwoOrMore(obj, ['name', 'author', 'description'])).toBe(false);
    });

    test('should return false when fewer than two properties have values', () => {
      const obj = {
        name: 'test',
        version: '',
        author: null,
        description: undefined
      };
      
      expect(hasTwoOrMore(obj, ['name', 'version', 'author', 'description'])).toBe(false);
      expect(hasTwoOrMore(obj, ['version', 'author', 'description'])).toBe(false);
    });

    test('should return false for empty or single key arrays', () => {
      const obj = { name: 'test', version: '1.0.0' };
      expect(hasTwoOrMore(obj, [])).toBe(false);
      expect(hasTwoOrMore(obj, ['name'])).toBe(false);
    });

    test('should handle non-existent properties', () => {
      const obj = { name: 'test', version: '1.0.0' };
      expect(hasTwoOrMore(obj, ['name', 'version', 'nonexistent' as keyof typeof obj])).toBe(true);
      expect(hasTwoOrMore(obj, ['nonexistent1' as keyof typeof obj, 'nonexistent2' as keyof typeof obj])).toBe(false);
    });

    test('should treat zero and false as valid values', () => {
      const obj = {
        count: 0,
        enabled: false,
        price: 100,
        empty: '',
        nothing: null
      };
      
      expect(hasTwoOrMore(obj, ['count', 'enabled', 'price'])).toBe(true);
      expect(hasTwoOrMore(obj, ['count', 'enabled', 'empty'])).toBe(true);
      expect(hasTwoOrMore(obj, ['empty', 'nothing'])).toBe(false);
    });

    test('should work with complex objects', () => {
      const packageInfo = {
        name: 'my-package',
        version: '1.0.0',
        author: '',
        license: 'MIT',
        repository: null,
        description: undefined
      };
      
      expect(hasTwoOrMore(packageInfo, ['name', 'version', 'license'])).toBe(true);
      expect(hasTwoOrMore(packageInfo, ['author', 'repository', 'description'])).toBe(false);
    });
  });
});

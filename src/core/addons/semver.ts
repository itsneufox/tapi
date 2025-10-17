import { logger } from '../../utils/logger';

export interface VersionConstraint {
  operator: '^' | '~' | '>=' | '<=' | '>' | '<' | '=' | '';
  version: string;
  raw: string;
}

export interface VersionRange {
  min?: string;
  max?: string;
  includeMin: boolean;
  includeMax: boolean;
}

/**
 * Semantic versioning utilities for addon dependencies
 */
export class SemVer {
  /**
   * Parse a version constraint string (e.g., "^1.0.0", "~2.1.0", ">=1.0.0 <2.0.0")
   */
  static parseConstraint(constraint: string): VersionConstraint {
    const trimmed = constraint.trim();
    
    // Handle complex ranges like ">=1.0.0 <2.0.0"
    if (trimmed.includes(' ') || trimmed.includes('||')) {
      return {
        operator: '',
        version: trimmed,
        raw: trimmed
      };
    }
    
    // Handle simple constraints
    const match = trimmed.match(/^([\^~><=]+)?(.+)$/);
    if (!match) {
      throw new Error(`Invalid version constraint: ${constraint}`);
    }
    
    const [, operator, version] = match;
    
    return {
      operator: (operator as VersionConstraint['operator']) || '=',
      version: version.trim(),
      raw: trimmed
    };
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  static compare(v1: string, v2: string): number {
    const v1Parts = this.parseVersion(v1);
    const v2Parts = this.parseVersion(v2);
    
    // Compare major version
    if (v1Parts.major !== v2Parts.major) {
      return v1Parts.major > v2Parts.major ? 1 : -1;
    }
    
    // Compare minor version
    if (v1Parts.minor !== v2Parts.minor) {
      return v1Parts.minor > v2Parts.minor ? 1 : -1;
    }
    
    // Compare patch version
    if (v1Parts.patch !== v2Parts.patch) {
      return v1Parts.patch > v2Parts.patch ? 1 : -1;
    }
    
    // Compare pre-release versions
    if (v1Parts.prerelease && !v2Parts.prerelease) return -1;
    if (!v1Parts.prerelease && v2Parts.prerelease) return 1;
    if (v1Parts.prerelease && v2Parts.prerelease) {
      return v1Parts.prerelease.localeCompare(v2Parts.prerelease);
    }
    
    return 0;
  }

  /**
   * Check if a version satisfies a constraint
   */
  static satisfies(version: string, constraint: string): boolean {
    try {
      const parsedConstraint = this.parseConstraint(constraint);
      
      // Handle complex ranges
      if (parsedConstraint.operator === '') {
        return this.satisfiesRange(version, parsedConstraint.raw);
      }
      
      // Handle simple constraints
      return this.satisfiesSimple(version, parsedConstraint);
    } catch {
      logger.warn(`⚠️ Invalid version constraint: ${constraint}`);
      return false;
    }
  }

  /**
   * Check if version satisfies a simple constraint
   */
  private static satisfiesSimple(version: string, constraint: VersionConstraint): boolean {
    const comparison = this.compare(version, constraint.version);
    
    switch (constraint.operator) {
      case '=':
      case '':
        return comparison === 0;
      case '>':
        return comparison > 0;
      case '>=':
        return comparison >= 0;
      case '<':
        return comparison < 0;
      case '<=':
        return comparison <= 0;
      case '^':
        return this.satisfiesCaret(version, constraint.version);
      case '~':
        return this.satisfiesTilde(version, constraint.version);
      default:
        return false;
    }
  }

  /**
   * Check if version satisfies caret constraint (^1.0.0)
   */
  private static satisfiesCaret(version: string, targetVersion: string): boolean {
    const target = this.parseVersion(targetVersion);
    const versionParts = this.parseVersion(version);
    
    // If major version is 0, caret behaves like tilde
    if (target.major === 0) {
      return this.satisfiesTilde(version, targetVersion);
    }
    
    // Allow changes that do not modify the leftmost non-zero digit
    return versionParts.major === target.major && 
           this.compare(version, `${target.major}.0.0`) >= 0 &&
           this.compare(version, `${target.major + 1}.0.0`) < 0;
  }

  /**
   * Check if version satisfies tilde constraint (~1.2.3)
   */
  private static satisfiesTilde(version: string, targetVersion: string): boolean {
    const target = this.parseVersion(targetVersion);
    const versionParts = this.parseVersion(version);
    
    // Allow patch-level changes if a minor version is specified
    // Allow minor-level changes if a major version is specified
    if (target.minor !== undefined) {
      return versionParts.major === target.major &&
             versionParts.minor === target.minor &&
             this.compare(version, targetVersion) >= 0 &&
             this.compare(version, `${target.major}.${target.minor + 1}.0`) < 0;
    } else {
      return versionParts.major === target.major &&
             this.compare(version, targetVersion) >= 0 &&
             this.compare(version, `${target.major + 1}.0.0`) < 0;
    }
  }

  /**
   * Check if version satisfies a complex range (>=1.0.0 <2.0.0)
   */
  private static satisfiesRange(version: string, range: string): boolean {
    const parts = range.split(' ').filter(part => part.trim() !== '');
    const ranges: VersionRange[] = [];
    
    // Parse each part of the range
    for (let i = 0; i < parts.length; i += 2) {
      const minPart = parts[i];
      const maxPart = parts[i + 1];
      
      const range: VersionRange = {
        includeMin: true,
        includeMax: true
      };
      
      // Parse minimum version
      if (minPart) {
        const minConstraint = this.parseConstraint(minPart);
        range.min = minConstraint.version;
        range.includeMin = minConstraint.operator === '>=' || minConstraint.operator === '=';
      }
      
      // Parse maximum version
      if (maxPart) {
        const maxConstraint = this.parseConstraint(maxPart);
        range.max = maxConstraint.version;
        range.includeMax = maxConstraint.operator === '<=' || maxConstraint.operator === '=';
      }
      
      ranges.push(range);
    }
    
    // Check if version satisfies any range
    return ranges.some(range => {
      let satisfies = true;
      
      if (range.min) {
        const minComparison = this.compare(version, range.min);
        satisfies = satisfies && (range.includeMin ? minComparison >= 0 : minComparison > 0);
      }
      
      if (range.max) {
        const maxComparison = this.compare(version, range.max);
        satisfies = satisfies && (range.includeMax ? maxComparison <= 0 : maxComparison < 0);
      }
      
      return satisfies;
    });
  }

  /**
   * Parse a version string into parts
   */
  private static parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }
    
    const [, major, minor, patch, prerelease] = match;
    
    return {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
      prerelease: prerelease
    };
  }

  /**
   * Find the best version that satisfies all constraints
   */
  static findBestVersion(versions: string[], constraints: string[]): string | null {
    const validVersions = versions.filter(version => 
      constraints.every(constraint => this.satisfies(version, constraint))
    );
    
    if (validVersions.length === 0) {
      return null;
    }
    
    // Sort versions in descending order and return the highest
    return validVersions.sort((a, b) => this.compare(b, a))[0];
  }

  /**
   * Check for version conflicts between constraints
   */
  static detectConflicts(constraints: string[]): Array<{ constraint1: string; constraint2: string; reason: string }> {
    const conflicts: Array<{ constraint1: string; constraint2: string; reason: string }> = [];
    
    for (let i = 0; i < constraints.length; i++) {
      for (let j = i + 1; j < constraints.length; j++) {
        const constraint1 = constraints[i];
        const constraint2 = constraints[j];
        
        // Check if constraints are incompatible
        if (!this.constraintsCompatible(constraint1, constraint2)) {
          conflicts.push({
            constraint1,
            constraint2,
            reason: 'Incompatible version constraints'
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check if two constraints are compatible
   */
  private static constraintsCompatible(constraint1: string, constraint2: string): boolean {
    // This is a simplified check - in practice, you'd need more sophisticated logic
    try {
      const parsed1 = this.parseConstraint(constraint1);
      const parsed2 = this.parseConstraint(constraint2);
      
      // If both constraints specify exact versions, they must be the same
      if (parsed1.operator === '=' && parsed2.operator === '=') {
        return parsed1.version === parsed2.version;
      }
      
      // For other cases, assume compatible unless proven otherwise
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a version string format
   */
  static isValidVersion(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a constraint string format
   */
  static isValidConstraint(constraint: string): boolean {
    try {
      this.parseConstraint(constraint);
      return true;
    } catch {
      return false;
    }
  }
}



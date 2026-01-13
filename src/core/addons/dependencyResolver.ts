import { logger } from '../../utils/logger';
import { AddonInfo } from './types';
import { AddonManager } from './manager';
import { SemVer } from './semver';

/**
 * Node representation for each addon within the dependency graph.
 */
export interface DependencyGraph {
  [addonName: string]: {
    addon: AddonInfo;
    dependencies: string[];
    dependents: string[];
  };
}

/**
 * Result details produced when resolving dependencies for an addon.
 */
export interface DependencyResolution {
  resolved: string[];
  conflicts: Array<{
    addon: string;
    conflict: string;
    reason: string;
  }>;
  missing: string[];
  versionConflicts: Array<{
    addon: string;
    constraint: string;
    availableVersion: string;
    reason: string;
  }>;
}

/**
 * Performs dependency traversal, conflict detection, and auto-install planning for addons.
 */
export class DependencyResolver {
  private addonManager: AddonManager;

  constructor(addonManager: AddonManager) {
    this.addonManager = addonManager;
  }

  /**
   * Build a dependency graph from all addons
   */
  async buildDependencyGraph(): Promise<DependencyGraph> {
    const allAddons = await this.addonManager.listAddons();
    const graph: DependencyGraph = {};

    // Initialize graph nodes
    for (const addon of allAddons) {
      graph[addon.name] = {
        addon,
        dependencies: addon.dependencies || [],
        dependents: []
      };
    }

    // Build dependency relationships
    for (const addon of allAddons) {
      for (const dep of addon.dependencies || []) {
        if (graph[dep]) {
          graph[dep].dependents.push(addon.name);
        }
      }
    }

    return graph;
  }

  /**
   * Resolve dependencies for an addon installation
   */
  async resolveDependencies(addonName: string, _targetVersion?: string): Promise<DependencyResolution> {
    try {
      logger.detail(`Resolving dependencies for: ${addonName}`);

      const resolution: DependencyResolution = {
        resolved: [],
        conflicts: [],
        missing: [],
        versionConflicts: []
      };

      // Get addon info
      const addonInfo = this.addonManager.getLoader().getAddonInfo(addonName);
      if (!addonInfo) {
        resolution.missing.push(addonName);
        return resolution;
      }

      // Build dependency graph
      const graph = await this.buildDependencyGraph();
      
      // Resolve dependencies recursively
      await this.resolveAddonDependencies(addonName, graph, resolution, new Set());

      // Check for conflicts
      this.checkDependencyConflicts(resolution, graph);
      
      // Check for version conflicts
      this.checkVersionConflicts(resolution, graph);

      logger.detail(`Dependency resolution complete: ${resolution.resolved.length} resolved, ${resolution.conflicts.length} conflicts, ${resolution.missing.length} missing, ${resolution.versionConflicts.length} version conflicts`);

      return resolution;

    } catch (error) {
      logger.error(`Failed to resolve dependencies for ${addonName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw error;
    }
  }

  /**
   * Recursively resolve addon dependencies
   */
  private async resolveAddonDependencies(
    addonName: string,
    graph: DependencyGraph,
    resolution: DependencyResolution,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(addonName)) {
      // Circular dependency detected
      resolution.conflicts.push({
        addon: addonName,
        conflict: 'circular',
        reason: `Circular dependency detected involving ${addonName}`
      });
      return;
    }

    visited.add(addonName);

    const node = graph[addonName];
    if (!node) {
      resolution.missing.push(addonName);
      return;
    }

    // Add this addon to resolved list if not already there
    if (!resolution.resolved.includes(addonName)) {
      resolution.resolved.push(addonName);
    }

    // Resolve dependencies
    for (const dep of node.dependencies) {
      await this.resolveAddonDependencies(dep, graph, resolution, new Set(visited));
    }

    visited.delete(addonName);
  }

  /**
   * Check for dependency conflicts
   */
  private checkDependencyConflicts(resolution: DependencyResolution, graph: DependencyGraph): void {
    const resolvedVersions = new Map<string, string>();

    for (const addonName of resolution.resolved) {
      const addonInfo = graph[addonName]?.addon;
      if (addonInfo) {
        const existingVersion = resolvedVersions.get(addonName);
        if (existingVersion && existingVersion !== addonInfo.version) {
          resolution.conflicts.push({
            addon: addonName,
            conflict: 'version',
            reason: `Version conflict: ${existingVersion} vs ${addonInfo.version}`
          });
        } else {
          resolvedVersions.set(addonName, addonInfo.version);
        }
      }
    }
  }

  /**
   * Check for version constraint conflicts
   */
  private checkVersionConflicts(resolution: DependencyResolution, graph: DependencyGraph): void {
    // Collect all version constraints for each dependency
    const dependencyConstraints = new Map<string, string[]>();
    
    for (const addonName of resolution.resolved) {
      const addonInfo = graph[addonName]?.addon;
      if (addonInfo && addonInfo.dependencyConstraints) {
        for (const [depName, constraint] of Object.entries(addonInfo.dependencyConstraints)) {
          if (!dependencyConstraints.has(depName)) {
            dependencyConstraints.set(depName, []);
          }
          dependencyConstraints.get(depName)!.push(constraint);
        }
      }
    }
    
    // Check for conflicts in each dependency's constraints
    for (const [depName, constraints] of dependencyConstraints) {
      if (constraints.length > 1) {
        const conflicts = SemVer.detectConflicts(constraints);
        for (const conflict of conflicts) {
          resolution.versionConflicts.push({
            addon: depName,
            constraint: `${conflict.constraint1} vs ${conflict.constraint2}`,
            availableVersion: 'unknown',
            reason: conflict.reason
          });
        }
      }
      
      // Check if the available version satisfies all constraints
      const depInfo = this.addonManager.getLoader().getAddonInfo(depName);
      if (depInfo) {
        for (const constraint of constraints) {
          if (!SemVer.satisfies(depInfo.version, constraint)) {
            resolution.versionConflicts.push({
              addon: depName,
              constraint,
              availableVersion: depInfo.version,
              reason: `Version ${depInfo.version} does not satisfy constraint ${constraint}`
            });
          }
        }
      }
    }
  }

  /**
   * Get installation order for dependencies
   */
  getInstallationOrder(resolution: DependencyResolution): string[] {
    const installed = new Set<string>();
    const order: string[] = [];

    const installDependencies = (addonName: string) => {
      if (installed.has(addonName)) return;

      const addonInfo = this.addonManager.getLoader().getAddonInfo(addonName);
      if (addonInfo) {
        // Install dependencies first
        for (const dep of addonInfo.dependencies || []) {
          installDependencies(dep);
        }

        // Then install this addon
        if (!installed.has(addonName)) {
          order.push(addonName);
          installed.add(addonName);
        }
      }
    };

    // Install all resolved addons
    for (const addonName of resolution.resolved) {
      installDependencies(addonName);
    }

    return order;
  }

  /**
   * Get uninstallation order (reverse of installation)
   */
  async getUninstallationOrder(addonName: string): Promise<string[]> {
    const graph = await this.addonManager.getDependencyGraph();
    const order: string[] = [];

    const uninstallDependents = (name: string, visited: Set<string>) => {
      if (visited.has(name)) return;
      visited.add(name);

      const node = graph[name];
      if (node) {
        // Uninstall dependents first
        for (const dependent of node.dependents) {
          uninstallDependents(dependent, visited);
        }

        // Then uninstall this addon
        order.push(name);
      }
    };

    uninstallDependents(addonName, new Set());
    return order;
  }

  /**
   * Validate that all dependencies are satisfied
   */
  validateDependencies(addonName: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const addonInfo = this.addonManager.getLoader().getAddonInfo(addonName);

    if (!addonInfo) {
      issues.push(`Addon ${addonName} not found`);
      return { valid: false, issues };
    }

    // Check each dependency
    for (const dep of addonInfo.dependencies || []) {
      const depInfo = this.addonManager.getLoader().getAddonInfo(dep);
      if (!depInfo) {
        issues.push(`Missing dependency: ${dep}`);
      } else if (!depInfo.enabled) {
        issues.push(`Disabled dependency: ${dep}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Automatically install missing dependencies
   */
  async autoInstallDependencies(resolution: DependencyResolution, options: Record<string, unknown> = {}): Promise<{ installed: string[]; failed: string[] }> {
    const result = { installed: [] as string[], failed: [] as string[] };
    
    if (resolution.missing.length === 0) {
      return result;
    }

    logger.info(`Auto-installing ${resolution.missing.length} missing dependencies...`);

    for (const missingDep of resolution.missing) {
      try {
        logger.info(`Installing dependency: ${missingDep}`);
        await this.addonManager.installAddon(missingDep, options);
        result.installed.push(missingDep);
        logger.success(`Installed: ${missingDep}`);
      } catch (error) {
        result.failed.push(missingDep);
        logger.error(`Failed to install ${missingDep}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Get installation order for dependencies with auto-install support
   */
  async getInstallationOrderWithAutoInstall(addonName: string, options: Record<string, unknown> = {}): Promise<{ order: string[]; autoInstalled: string[] }> {
    const resolution = await this.resolveDependencies(addonName);
    
    // Auto-install missing dependencies first
    const autoInstallResult = await this.autoInstallDependencies(resolution, options);
    
    // Get installation order for all resolved addons
    const order = this.getInstallationOrder(resolution);
    
    return {
      order,
      autoInstalled: autoInstallResult.installed
    };
  }

  /**
   * Suggest solutions for dependency issues
   */
  suggestSolutions(resolution: DependencyResolution): string[] {
    const suggestions: string[] = [];

    if (resolution.missing.length > 0) {
      suggestions.push(`Install missing dependencies: tapi addon install ${resolution.missing.join(' ')}`);
      suggestions.push(`Or use --auto-deps flag for automatic installation`);
    }

    if (resolution.conflicts.length > 0) {
      suggestions.push('Resolve conflicts by:');
      for (const conflict of resolution.conflicts) {
        if (conflict.conflict === 'circular') {
          suggestions.push(`  - Remove circular dependency involving ${conflict.addon}`);
        } else if (conflict.conflict === 'version') {
          suggestions.push(`  - Update addon versions to resolve conflict: ${conflict.reason}`);
        }
      }
    }

    if (resolution.versionConflicts.length > 0) {
      suggestions.push('Resolve version conflicts by:');
      for (const versionConflict of resolution.versionConflicts) {
        suggestions.push(`  - ${versionConflict.addon}: ${versionConflict.reason}`);
        suggestions.push(`    Available version: ${versionConflict.availableVersion}`);
        suggestions.push(`    Required constraint: ${versionConflict.constraint}`);
      }
      suggestions.push('  - Update addon versions or adjust version constraints in addon configuration');
    }

    return suggestions;
  }
}

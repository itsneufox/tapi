import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

/**
 * User-level configuration persisted on disk under ~/.tapi/config.json.
 */
interface Config {
  githubToken?: string;
  defaultAuthor?: string;
  editor?: 'VS Code' | 'Sublime Text' | 'Other/None';
  setupComplete?: boolean;
  serverState?: {
    pid?: number;
    serverPath?: string;
    tempFiles?: string[];
  };
}

/**
 * Provides typed access to the persisted tapi configuration file.
 */
export class ConfigManager {
  private configPath: string;
  private config: Config;

  /**
   * Create a new config manager bound to the default ~/.tapi/config.json path.
   */
  constructor() {
    this.configPath = path.join(os.homedir(), '.tapi', 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load the latest configuration from disk, returning an empty object when the file is missing.
   */
  private loadConfig(): Config {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      logger.error(
        `❌ Error loading config: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      return {};
    }
  }

  /**
   * Persist the current config state to disk.
   */
  public saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(
        `❌ Error saving config: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Resolve the GitHub token from environment variable or persisted config.
   */
  public getGitHubToken(): string | undefined {
    const envToken = process.env.TAPI_GITHUB_TOKEN;
    if (envToken) {
      return envToken;
    }
    return this.config.githubToken;
  }

  /**
   * Store the GitHub token and persist it.
   */
  public setGitHubToken(token: string): void {
    this.config.githubToken = token;
    this.saveConfig();
  }

  /**
   * Retrieve the default project author value.
   */
  public getDefaultAuthor(): string | undefined {
    return this.config.defaultAuthor;
  }

  /**
   * Persist a default project author to the config.
   */
  public setDefaultAuthor(author: string): void {
    this.config.defaultAuthor = author;
    this.saveConfig();
  }

  /**
   * Get the preferred editor selection, if one has been configured.
   */
  public getEditor(): 'VS Code' | 'Sublime Text' | 'Other/None' | undefined {
    return this.config.editor;
  }

  /**
   * Persist the preferred editor selection.
   */
  public setEditor(editor: 'VS Code' | 'Sublime Text' | 'Other/None'): void {
    this.config.editor = editor;
    this.saveConfig();
  }

  /**
   * Determine whether the initial setup wizard has been completed.
   */
  public isSetupComplete(): boolean {
    return !!this.config.setupComplete;
  }

  /**
   * Mark the setup process as complete or incomplete.
   */
  public setSetupComplete(complete: boolean): void {
    this.config.setupComplete = complete;
    this.saveConfig();
  }

  /**
   * Retrieve the cached server process state.
   */
  public getServerState(): Config['serverState'] {
    return this.config.serverState || {};
  }

  /**
   * Persist the server process state for crash recovery.
   *
   * @param state - Process metadata (pid, working directory, temp files).
   */
  public saveServerState(state: Config['serverState']): void {
    this.config.serverState = state;
    this.saveConfig();
  }

  /**
   * Clear any stored server state data.
   */
  public clearServerState(): void {
    this.config.serverState = {};
    this.saveConfig();
  }

  /**
   * Read a configuration value by key.
   *
   * @param key - Property name to fetch.
   */
  public get<K extends keyof Config>(key: K): Config[K] | undefined {
    return this.config[key];
  }

  /**
   * Set and persist a configuration value by key.
   *
   * @param key - Property name to assign.
   * @param value - Value to store.
   */
  public set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  /**
   * Return a shallow copy of the in-memory configuration object.
   */
  public getFullConfig(): Readonly<Config> {
    return { ...this.config };
  }

  /**
   * Reset the configuration to defaults and persist the empty document.
   */
  public reset(): void {
    this.config = {};
    this.saveConfig();
    logger.detail('Configuration reset to defaults');
  }
}

export const configManager = new ConfigManager();

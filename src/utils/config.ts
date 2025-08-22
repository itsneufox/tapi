import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

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

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    this.configPath = path.join(os.homedir(), '.pawnctl', 'config.json');
    this.config = this.loadConfig();
  }

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
        `Error loading config: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      return {};
    }
  }

  public saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(
        `Error saving config: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  public getGitHubToken(): string | undefined {
    const envToken = process.env.NPT_GITHUB_TOKEN;
    if (envToken) {
      return envToken;
    }
    return this.config.githubToken;
  }

  public setGitHubToken(token: string): void {
    this.config.githubToken = token;
    this.saveConfig();
  }

  public getDefaultAuthor(): string | undefined {
    return this.config.defaultAuthor;
  }

  public setDefaultAuthor(author: string): void {
    this.config.defaultAuthor = author;
    this.saveConfig();
  }

  public getEditor(): 'VS Code' | 'Sublime Text' | 'Other/None' | undefined {
    return this.config.editor;
  }

  public setEditor(editor: 'VS Code' | 'Sublime Text' | 'Other/None'): void {
    this.config.editor = editor;
    this.saveConfig();
  }

  public isSetupComplete(): boolean {
    return !!this.config.setupComplete;
  }

  public setSetupComplete(complete: boolean): void {
    this.config.setupComplete = complete;
    this.saveConfig();
  }

  public getServerState(): Config['serverState'] {
    return this.config.serverState || {};
  }

  public saveServerState(state: Config['serverState']): void {
    this.config.serverState = state;
    this.saveConfig();
  }

  public clearServerState(): void {
    this.config.serverState = {};
    this.saveConfig();
  }

  public get<K extends keyof Config>(key: K): Config[K] | undefined {
    return this.config[key];
  }

  public set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  public getFullConfig(): Readonly<Config> {
    return { ...this.config };
  }

  public reset(): void {
    this.config = {};
    this.saveConfig();
    logger.detail('Configuration reset to defaults');
  }
}

export const configManager = new ConfigManager();

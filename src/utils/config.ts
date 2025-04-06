import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

interface Config {
  githubToken?: string;
  defaultAuthor?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    this.configPath = path.join(os.homedir(), '.npt', 'config.json');
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
}

export const configManager = new ConfigManager();

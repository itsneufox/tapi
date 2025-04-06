import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

export const SERVER_STATE_FILE = path.join(
  os.homedir(),
  '.pawnctl',
  'server_state.json'
);

export interface ServerState {
  pid?: number;
  serverPath?: string;
  tempFiles?: string[];
}

export function saveServerState(state: ServerState): void {
  try {
    const stateDir = path.dirname(SERVER_STATE_FILE);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(SERVER_STATE_FILE, JSON.stringify(state, null, 2));
    logger.detail('Server state saved');
  } catch (error) {
    logger.error(
      `Failed to save server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

export function loadServerState(): ServerState {
  try {
    if (fs.existsSync(SERVER_STATE_FILE)) {
      const data = fs.readFileSync(SERVER_STATE_FILE, 'utf8');
      logger.detail('Server state loaded');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn(
      `Failed to load server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
  return {};
}

export function clearServerState(): void {
  try {
    if (fs.existsSync(SERVER_STATE_FILE)) {
      fs.unlinkSync(SERVER_STATE_FILE);
      logger.detail('Server state cleared');
    }
  } catch (error) {
    logger.warn(
      `Failed to clear server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

export function isServerRunning(): boolean {
  const state = loadServerState();
  if (!state.pid) return false;

  try {
    if (process.platform === 'win32') {
      const result = require('child_process').spawnSync(
        'tasklist',
        ['/FI', `PID eq ${state.pid}`],
        { encoding: 'utf8' }
      );
      return result.stdout.includes(state.pid.toString());
    } else {
      process.kill(state.pid, 0);
      return true;
    }
  } catch {
    return false;
  }
}

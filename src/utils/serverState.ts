import { configManager } from './config';
import { logger } from './logger';

/**
 * Snapshot describing the running dedicated server process.
 */
export interface ServerState {
  pid?: number;
  serverPath?: string;
  tempFiles?: string[];
  startTime?: string;
  args?: string[];
  windowMode?: boolean;
}

/**
 * Persist the provided server state so the process can be recovered/resumed.
 */
export function saveServerState(state: ServerState): void {
  try {
    configManager.saveServerState(state);
    logger.detail('Server state saved');
  } catch (error) {
    logger.error(
      `Failed to save server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

/**
 * Retrieve the last known server state from config.
 */
export function loadServerState(): ServerState {
  try {
    return configManager.getServerState() || {};
  } catch (error) {
    logger.warn(
      `Failed to load server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return {};
  }
}

/**
 * Remove any saved server state information.
 */
export function clearServerState(): void {
  try {
    configManager.clearServerState();
    logger.detail('Server state cleared');
  } catch (error) {
    logger.warn(
      `Failed to clear server state: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

/**
 * Determine whether the stored server process is still active.
 *
 * Checks PID when available, otherwise falls back to process name matching in window mode.
 */
export function isServerRunning(): boolean {
  const state = loadServerState();
  
  // If we have a PID, check if the process is running
  if (state.pid) {
    try {
      if (process.platform === 'win32') {
        const { spawnSync } = require('child_process');
        const result = spawnSync('tasklist', ['/FI', `PID eq ${state.pid}`], {
          encoding: 'utf8',
        });
        return result.stdout.includes(state.pid.toString());
      } else {
        process.kill(state.pid, 0);
        return true;
      }
    } catch {
      return false;
    }
  }
  
  // If we're in window mode without PID, check by process name
  if (state.windowMode && state.serverPath) {
    try {
      const { basename } = require('path');
      const processName = basename(state.serverPath);
      
      if (process.platform === 'win32') {
        const { spawnSync } = require('child_process');
        const result = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${processName}`], {
          encoding: 'utf8',
        });
        return result.stdout.includes(processName);
      } else {
        const { spawnSync } = require('child_process');
        const result = spawnSync('pgrep', ['-f', processName], {
          encoding: 'utf8',
        });
        return result.status === 0;
      }
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Provide the current running status alongside the stored server metadata.
 */
export function getServerStatus(): { running: boolean; state: ServerState } {
  const state = loadServerState();
  const running = isServerRunning();

  return {
    running,
    state,
  };
}

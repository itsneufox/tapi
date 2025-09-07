import { Command } from 'commander';
import { logger } from '../utils/logger';

// Static imports for all commands - required for pkg compatibility
import buildCommand from './build/build';
import configCommand from './config/config';
import initCommand from './init/index';
import installCommand from './install/install';
import killCommand from './kill/kill';
import setupCommand from './setup/setup';
import startCommand from './start/start';
import uninstallCommand from './uninstall/uninstall';
import updateCommand from './update/update';

export function registerCommands(program: Command): void {
  const commands = [
    { name: 'build', register: buildCommand },
    { name: 'config', register: configCommand },
    { name: 'init', register: initCommand },
    { name: 'install', register: installCommand },
    { name: 'kill', register: killCommand },
    { name: 'setup', register: setupCommand },
    { name: 'start', register: startCommand },
    { name: 'uninstall', register: uninstallCommand },
    { name: 'update', register: updateCommand },
  ];

  for (const command of commands) {
    try {
      if (typeof command.register === 'function') {
        command.register(program);
        logger.detail(`Registered command: ${command.name}`);
      } else {
        logger.warn(`Command ${command.name} does not export a function`);
      }
    } catch (error) {
      logger.warn(
        `Failed to load command ${command.name}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }
}

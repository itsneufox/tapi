import { Command } from 'commander';
import { logger } from '../utils/logger';

// Static command imports - works reliably in EXE environment
import setupCommand from './setup/setup';
import buildCommand from './build/build';
import configCommand from './config/config';
import initCommand from './init/index';
import installCommand from './install/install';
import killCommand from './kill/kill';
import runCommand from './run/index';
import startCommand from './start/start';
import { createUninstallCommand } from './uninstall/uninstall';
import updateCommand from './update/update';
import addonsCommand from './addons/index';

export function registerCommands(program: Command): void {
  logger.detail('🔧 Registering commands...');
  
  try {
    // Register all commands statically
    setupCommand(program);
    logger.detail('✅ Registered setup command');
    
    buildCommand(program);
    logger.detail('✅ Registered build command');
    
    configCommand(program);
    logger.detail('✅ Registered config command');
    
    initCommand(program);
    logger.detail('✅ Registered init command');
    
    installCommand(program);
    logger.detail('✅ Registered install command');
    
    killCommand(program);
    logger.detail('✅ Registered kill command');
    
    runCommand(program);
    logger.detail('✅ Registered run command');
    
    startCommand(program);
    logger.detail('✅ Registered start command');
    
    program.addCommand(createUninstallCommand());
    logger.detail('✅ Registered uninstall command');
    
    updateCommand(program);
    logger.detail('✅ Registered update command');
    
    addonsCommand(program);
    logger.detail('✅ Registered addons command');
    
    logger.detail(`🎯 Total commands registered: ${program.commands.length}`);
  } catch (error) {
    logger.error(`❌ Command registration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    throw error;
  }
}

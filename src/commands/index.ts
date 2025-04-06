import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export function registerCommands(program: Command): void {
  const registeredCommands = new Set<string>();
  const commandsDir = path.join(__dirname);

  const filesInRoot = fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .filter((file) => !file.startsWith('index.') && !file.startsWith('_'));

  const foldersInRoot = fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
    .map((dirent) => dirent.name);

  for (const file of filesInRoot) {
    const commandName = path.basename(file, path.extname(file));
    
    if (registeredCommands.has(commandName)) {
      logger.warn(`Command '${commandName}' is already registered, skipping duplicate from file: ${file}`);
      continue;
    }
    
    try {
      const commandModule = require(path.join(commandsDir, file));
      const registerFn =
        commandModule.default ||
        commandModule[`${commandName}Command`] ||
        commandModule.registerCommand;

      if (typeof registerFn === 'function') {
        registerFn(program);
        registeredCommands.add(commandName);
        logger.detail(`Registered command from file: ${file}`);
      }
    } catch (error) {
      logger.warn(
        `Failed to load command from ${file}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  for (const folder of foldersInRoot) {
    if (registeredCommands.has(folder)) {
      logger.warn(`Command '${folder}' is already registered, skipping duplicate from folder`);
      continue;
    }
    
    const folderPath = path.join(commandsDir, folder);
    const possibleFiles = [
      path.join(folderPath, `${folder}.ts`),
      path.join(folderPath, `${folder}.js`),
      path.join(folderPath, 'main.ts'),
      path.join(folderPath, 'main.js'),
      path.join(folderPath, 'index.ts'),
      path.join(folderPath, 'index.js'),
    ];

    let commandModule = null;
    let loadedFile = '';

    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        try {
          commandModule = require(file);
          loadedFile = path.basename(file);
          break;
        } catch {
          continue;
        }
      }
    }

    if (commandModule) {
      const registerFn =
        commandModule.default ||
        commandModule[`${folder}Command`] ||
        commandModule.registerCommand;

      if (typeof registerFn === 'function') {
        registerFn(program);
        registeredCommands.add(folder);
        logger.detail(
          `Registered command from folder: ${folder}/${loadedFile}`
        );
      } else {
        logger.warn(
          `Command module ${folder}/${loadedFile} doesn't export a valid registration function`
        );
      }
    } else {
      logger.warn(`Could not find a valid command file in folder: ${folder}`);
    }
  }
}
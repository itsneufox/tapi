import { Command } from 'commander';
import { initCommand } from './init';
import { buildCommand } from './build';
import { startCommand } from './start';

export function registerCommands(program: Command): void {
  initCommand(program);
  buildCommand(program);
  startCommand(program);
}
import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { AddonCommand, CommandResolver as ICommandResolver } from './types';

/**
 * Coordinates addon-provided commands with the base Commander program,
 * handling overrides, conflicts, and fallbacks.
 */
export class CommandResolver implements ICommandResolver {
  private addonCommands: Map<string, AddonCommand> = new Map();
  private originalCommands: Map<string, () => Promise<void>> = new Map();
  private commandConflicts: Map<string, AddonCommand[]> = new Map();
  private program: Command;

  constructor(program: Command) {
    this.program = program;
  }

  /**
   * Register an addon command
   */
  registerCommand(command: AddonCommand): void {
    const existingCommand = this.addonCommands.get(command.name);
    
    if (existingCommand) {
      this.handleCommandConflict(command.name, existingCommand, command);
    } else {
      this.addonCommands.set(command.name, command);
      logger.detail(`Registered addon command: ${command.name} (priority: ${command.priority || 0})`);
    }
  }

  /**
   * Handle command conflicts between addons
   */
  private handleCommandConflict(commandName: string, existingCommand: AddonCommand, newCommand: AddonCommand): void {
    const existingPriority = existingCommand.priority || 0;
    const newPriority = newCommand.priority || 0;
    
    if (newPriority > existingPriority) {
      logger.warn(`Command conflict resolved: ${commandName} overridden by higher priority addon`);
      this.addonCommands.set(commandName, newCommand);
      if (!this.commandConflicts.has(commandName)) {
        this.commandConflicts.set(commandName, []);
      }
      this.commandConflicts.get(commandName)!.push(existingCommand, newCommand);
    } else if (newPriority === existingPriority) {
      logger.warn(`Command conflict: ${commandName} already registered with same priority. Keeping first addon.`);
      if (!this.commandConflicts.has(commandName)) {
        this.commandConflicts.set(commandName, []);
      }
      this.commandConflicts.get(commandName)!.push(existingCommand, newCommand);
    } else {
      logger.info(`Command ${commandName} already registered with higher priority. Ignoring new addon.`);
    }
  }

  /**
   * Store a reference to an original command handler
   */
  storeOriginalCommand(commandName: string, handler: () => Promise<void>): void {
    this.originalCommands.set(commandName, handler);
  }

  /**
   * Resolve which command handler to use for a given command name
   */
  resolveCommand(commandName: string): AddonCommand | null {
    return this.addonCommands.get(commandName) || null;
  }

  /**
   * Get the original command handler for a command name
   */
  getOriginalCommand(commandName: string): (() => Promise<void>) | null {
    return this.originalCommands.get(commandName) || null;
  }

  /**
   * Check if a command is overridden by an addon
   */
  isCommandOverridden(commandName: string): boolean {
    const addonCommand = this.addonCommands.get(commandName);
    return addonCommand?.override === true;
  }

  /**
   * Get all registered addon commands, sorted by priority
   */
  getAllAddonCommands(): AddonCommand[] {
    return Array.from(this.addonCommands.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Register addon commands with the Commander program
   */
  registerAddonCommandsWithProgram(): void {
    const addonCommands = this.getAllAddonCommands();
    
    for (const command of addonCommands) {
      if (command.override) {
        logger.detail(`Overriding command: ${command.name}`);
        this.overrideCommand(command);
      } else {
        logger.detail(`Adding new command: ${command.name}`);
        this.addNewCommand(command);
      }
    }
  }

  /**
   * Override an existing command with an addon implementation
   */
  private overrideCommand(addonCommand: AddonCommand): void {
    const existingCommand = this.program.commands.find(cmd => cmd.name() === addonCommand.name);
    
    if (existingCommand) {
      const originalHandler = (existingCommand as unknown as { _actionHandler: () => Promise<void> })._actionHandler;
      if (originalHandler) {
        this.storeOriginalCommand(addonCommand.name, originalHandler);
      }

      existingCommand.action(async (...args: unknown[]) => {
        try {
          const commandArgs = args.slice(0, -1) as string[];
          const commandOptions = args[args.length - 1] as Record<string, unknown>;
          await addonCommand.handler(commandArgs, commandOptions);
        } catch (error) {
          logger.error(`Addon command ${addonCommand.name} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          const originalHandler = this.getOriginalCommand(addonCommand.name);
          if (originalHandler) {
            logger.info(`Falling back to original ${addonCommand.name} command...`);
            try {
              await originalHandler();
            } catch (fallbackError) {
              logger.error(`Original command also failed: ${fallbackError instanceof Error ? fallbackError.message : 'unknown error'}`);
              process.exit(1);
            }
          } else {
            logger.error(`No fallback available for ${addonCommand.name}`);
            process.exit(1);
          }
        }
      });

      if (addonCommand.description && addonCommand.description !== existingCommand.description()) {
        existingCommand.description(`${addonCommand.description} (overridden by addon)`);
      }

      logger.detail(`Successfully overridden command: ${addonCommand.name}`);
    } else {
      logger.warn(`Cannot override command ${addonCommand.name}: command not found`);
    }
  }

  /**
   * Add a new command to the program
   */
  private addNewCommand(addonCommand: AddonCommand): void {
    const newCommand = this.program
      .command(addonCommand.name)
      .description(addonCommand.description)
      .action(async (...args: unknown[]) => {
        try {
          const commandArgs = args.slice(0, -1) as string[];
          const commandOptions = args[args.length - 1] as Record<string, unknown>;
          await addonCommand.handler(commandArgs, commandOptions);
        } catch (error) {
          logger.error(`Addon command ${addonCommand.name} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          logger.error(`Command ${addonCommand.name} is provided by an addon and failed. Check addon status with 'tapi addon list'`);
          process.exit(1);
        }
      });

    if (addonCommand.options) {
      for (const option of addonCommand.options) {
        const optionFlags = option.name.startsWith('-') ? option.name : `--${option.name}`;
        const optionDescription = option.description;
        
        if (option.required) {
          newCommand.requiredOption(optionFlags, optionDescription);
        } else {
          const defaultValue = option.default as string | boolean | string[] | undefined;
          newCommand.option(optionFlags, optionDescription, defaultValue);
        }
      }
    }

    logger.detail(`Successfully added new command: ${addonCommand.name}`);
  }

  /**
   * Get command conflict information
   */
  getCommandConflicts(): Map<string, AddonCommand[]> {
    return new Map(this.commandConflicts);
  }

  /**
   * Check if there are any command conflicts
   */
  hasConflicts(): boolean {
    return this.commandConflicts.size > 0;
  }

  /**
   * Get detailed conflict information for a specific command
   */
  getCommandConflictInfo(commandName: string): {
    hasConflict: boolean;
    conflictingAddons: AddonCommand[];
    currentAddon: AddonCommand | null;
  } {
    const currentAddon = this.addonCommands.get(commandName) || null;
    const conflictingAddons = this.commandConflicts.get(commandName) || [];
    
    return {
      hasConflict: conflictingAddons.length > 0,
      conflictingAddons,
      currentAddon
    };
  }

  /**
   * Get command statistics
   */
  getStats(): {
    totalAddonCommands: number;
    overriddenCommands: string[];
    newCommands: string[];
    conflicts: number;
    conflictedCommands: string[];
  } {
    const addonCommands = Array.from(this.addonCommands.values());
    const overriddenCommands = addonCommands
      .filter(cmd => cmd.override)
      .map(cmd => cmd.name);
    const newCommands = addonCommands
      .filter(cmd => !cmd.override)
      .map(cmd => cmd.name);

    return {
      totalAddonCommands: addonCommands.length,
      overriddenCommands,
      newCommands,
      conflicts: this.commandConflicts.size,
      conflictedCommands: Array.from(this.commandConflicts.keys())
    };
  }
}

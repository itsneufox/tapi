import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import { confirm } from '@inquirer/prompts';

export function createUninstallCommand(): Command {
  const command = new Command('uninstall');
  
  command
    .description('Uninstall pawnctl and remove all user data')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
      await handleUninstall(options);
    });

  return command;
}

async function handleUninstall(options: { force?: boolean }) {
  try {
    logger.info('Pawnctl Uninstaller');
    
    // Warning about what will be removed
    logger.warn('This will remove ALL pawnctl user data including:');
    logger.warn('   - Configuration files');
    logger.warn('   - Log files');  
    logger.warn('   - Cache data');
    logger.warn('   - The entire ~/.pawnctl directory');
    
    // Confirmation unless --force
    if (!options.force) {
      const shouldContinue = await confirm({
        message: 'Are you sure you want to continue?',
        default: false
      });
      
      if (!shouldContinue) {
        logger.info('Uninstall cancelled');
        return;
      }
    }
    
    // Get user data directory
    const pawnctlDir = path.join(os.homedir(), '.pawnctl');
    
    // Check if directory exists
    if (!fs.existsSync(pawnctlDir)) {
      logger.info('No user data found to remove');
      logger.info('Uninstall completed');
      return;
    }
    
    // Remove the directory
    logger.info('Removing user data...');
    fs.rmSync(pawnctlDir, { recursive: true, force: true });
    
    logger.info('User data removed successfully');
    logger.info('Removed directory: ' + pawnctlDir);
    
    // Final message
    logger.info('');
    logger.info('Pawnctl uninstall completed');
    logger.info('You can safely remove the pawnctl executable now');
    
  } catch (error) {
    logger.error('Failed to uninstall pawnctl');
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export default function (program: Command): void {
  program.addCommand(createUninstallCommand());
}

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import { confirm } from '@inquirer/prompts';

/**
 * Build the standalone `uninstall` command used to remove tapi user data.
 */
export function createUninstallCommand(): Command {
  const command = new Command('uninstall');
  
  command
    .description('Uninstall tapi and remove all user data')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
      await handleUninstall(options);
    });

  return command;
}

/**
 * Execute the uninstall workflow: prompt user, delete ~/.tapi, report status.
 */
async function handleUninstall(options: { force?: boolean }) {
  try {
    logger.info('Tapi Uninstaller');
    
    // Warning about what will be removed
    logger.warn('This will remove ALL tapi user data including:');
    logger.warn('   - Configuration files');
    logger.warn('   - Log files');  
    logger.warn('   - Cache data');
    logger.warn('   - The entire ~/.tapi directory');
    
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
    const tapiDir = path.join(os.homedir(), '.tapi');
    
    // Check if directory exists
    if (!fs.existsSync(tapiDir)) {
      logger.info('No user data found to remove');
      logger.info('Uninstall completed');
      return;
    }
    
    // Remove the directory
    logger.info('Removing user data...');
    fs.rmSync(tapiDir, { recursive: true, force: true });
    
    logger.info('User data removed successfully');
    logger.info('Removed directory: ' + tapiDir);
    
    // Final message
    logger.info('');
    logger.info('Tapi uninstall completed');
    logger.info('You can safely remove the tapi executable now');
    
  } catch (error) {
    logger.error('Failed to uninstall tapi');
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

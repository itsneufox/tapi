import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { showBanner } from '../../utils/banner';
import { loadManifest, type PackageManifest } from '../../core/manifest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export default function (program: Command): void {
  program
    .command('run [script]')
    .description('Run scripts defined in pawn.json')
    .option('--list', 'List available scripts')
    .action(async (scriptName, options) => {
      showBanner(false);
      
      try {
        const manifest = await loadManifest();
        if (!manifest) {
          logger.error('❌ No pawn.json manifest found. Run "tapi init" first.');
          process.exit(1);
        }
        
        if (options.list) {
          await listScripts(manifest);
          return;
        }
        
        if (!scriptName) {
          logger.error('❌ Please specify a script name or use --list to see available scripts');
          logger.info('Usage: tapi run <script-name>');
          process.exit(1);
        }
        
        await runScript(manifest, scriptName);
        
      } catch (error) {
        logger.error(`❌ Failed to run script: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

async function listScripts(manifest: PackageManifest): Promise<void> {
  const scripts = manifest.scripts || {};
  
  if (Object.keys(scripts).length === 0) {
    logger.info('No scripts defined in pawn.json');
    return;
  }
  
  logger.info('📜 Available scripts:');
  for (const [name, command] of Object.entries(scripts)) {
    logger.info(`  ${name}: ${command}`);
  }
}

async function runScript(manifest: PackageManifest, scriptName: string): Promise<void> {
  const scripts = manifest.scripts || {};
  
  if (!(scripts as Record<string, string>)[scriptName]) {
    logger.error(`❌ Script "${scriptName}" not found in pawn.json`);
    logger.info('Available scripts:');
    for (const name of Object.keys(scripts)) {
      logger.info(`  - ${name}`);
    }
    process.exit(1);
  }
  
  const command = (scripts as Record<string, string>)[scriptName];
  logger.info(`🚀 Running script: ${scriptName}`);
  logger.info(`📝 Command: ${command}`);
  
  try {
    // Parse the command to handle multiple commands separated by &&
    const commands = command.split('&&').map((cmd: string) => cmd.trim());
    
    for (const cmd of commands) {
      logger.info(`▶️  Executing: ${cmd}`);
      
      // Replace tapi with the actual executable path
      // Find the dist directory by looking up the directory tree
      let distPath = 'dist/index.js';
      let currentDir = process.cwd();
      
      // Look for dist directory in current and parent directories
      while (currentDir !== path.dirname(currentDir)) {
        const testDistPath = path.join(currentDir, 'dist', 'index.js');
        if (require('fs').existsSync(testDistPath)) {
          distPath = path.relative(process.cwd(), testDistPath);
          break;
        }
        currentDir = path.dirname(currentDir);
      }
      
      let processedCmd = cmd.replace(/^tapi\s+/, `node ${distPath} `);
      
      // Handle addon commands specially
      if (processedCmd.includes('addons run')) {
        // This will be handled by the addon system
        processedCmd = processedCmd.replace('node dist/index.js addons run', 'node dist/index.js addons run');
      }
      
      const { stdout, stderr } = await execAsync(processedCmd, {
        cwd: process.cwd()
      });
      
      if (stdout) {
        logger.info(stdout);
      }
      if (stderr) {
        logger.warn(stderr);
      }
    }
    
    logger.success(`✅ Script "${scriptName}" completed successfully`);
    
  } catch (error) {
    logger.error(`❌ Script "${scriptName}" failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(1);
  }
}

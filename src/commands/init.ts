import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import Spinner from 'ts-spinner';
import * as cliProgress from 'cli-progress';
import { logger } from '../utils/logger';
import { generatePackageManifest } from '../core/manifest';
import { input, select, confirm } from '@inquirer/prompts';
import simpleGit from 'simple-git';
import { configManager } from '../utils/config';
import { generateGamemodeTemplate } from '../templates/gamemode.template';
import { generateFilterscriptTemplate } from '../templates/filterscript.template';
import { generateLibraryTemplate } from '../templates/library.template';

interface ProjectAnswers {
  name: string;
  description: string;
  author: string;
  projectType: 'gamemode' | 'filterscript' | 'library';
  addStdLib: boolean;
  initGit: boolean;
  downloadServer: boolean;
  editor: 'VS Code' | 'Sublime Text' | 'Other/None';
}

function cleanupFiles(directory: string, keepItems: string[]): number {
  if (!fs.existsSync(directory)) {
    return 0;
  }
  
  try {
    const entries = fs.readdirSync(directory);
    let removedCount = 0;
    
    for (const entry of entries) {
      if (keepItems.includes(entry)) {
        continue;
      }
      
      const entryPath = path.join(directory, entry);
      const isDir = fs.statSync(entryPath).isDirectory();
      
      try {
        if (isDir) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(entryPath);
        }
        
        logger.detail(`Removed ${isDir ? 'directory' : 'file'}: ${directory}/${entry}`);
        removedCount++;
      } catch (err) {
        logger.warn(`Failed to remove ${entryPath}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
    
    return removedCount;
  } catch (err) {
    logger.warn(`Could not access directory ${directory}: ${err instanceof Error ? err.message : 'unknown error'}`);
    return 0;
  }
}

function cleanupGamemodeFiles(workingFile: string): void {
  const gamemodesDir = path.join(process.cwd(), 'gamemodes');
  if (!fs.existsSync(gamemodesDir)) {
    return;
  }
  
  try {
    const entries = fs.readdirSync(gamemodesDir);
    let removedCount = 0;
    
    for (const entry of entries) {
      if (entry === workingFile || entry === `${path.parse(workingFile).name}.inc`) {
        continue;
      }
      
      if (entry.endsWith('.pwn') || entry.endsWith('.amx')) {
        const filePath = path.join(gamemodesDir, entry);
        
        try {
          fs.unlinkSync(filePath);
          logger.detail(`Removed gamemode file: ${entry}`);
          removedCount++;
        } catch (err) {
          logger.warn(`Failed to remove ${filePath}: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    }
    
    if (removedCount > 0) {
      logger.routine(`Cleaned up gamemodes directory (removed ${removedCount} files)`);
    }
  } catch (err) {
    logger.warn(`Could not access gamemode directory: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

async function setupVSCodeIntegration(projectName: string): Promise<void> {
  const vscodeSpinner = new Spinner();
  vscodeSpinner.start('Setting up VS Code integration...');
  
  try {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    const nptDir = path.join(process.cwd(), '.npt');
    if (!fs.existsSync(nptDir)) {
      fs.mkdirSync(nptDir, { recursive: true });
    }
    
    const starterScript = `const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const exeNames = ['omp-server.exe', 'omp-server'];
let serverPath = null;

for (const name of exeNames) {
  const testPath = path.join(__dirname, '..', name);
  if (fs.existsSync(testPath)) {
    serverPath = testPath;
    break;
  }
}

if (!serverPath) {
  console.error('Server executable not found!');
  process.exit(1);
}

console.log('Starting server...');

const serverProcess = spawn(serverPath, [], {
  stdio: 'inherit',
  detached: false,
  cwd: path.join(__dirname, '..')
});

const serverStatePath = path.join(require('os').homedir(), '.npt', 'server_state.json');
const serverState = {
  pid: serverProcess.pid,
  serverPath: serverPath
};

try {
  const stateDir = path.dirname(serverStatePath);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  fs.writeFileSync(serverStatePath, JSON.stringify(serverState, null, 2));
} catch (error) {
  console.error('Failed to save server state:', error);
}

serverProcess.on('exit', (code) => {
  console.log(\`Server exited with code \${code || 0}\`);
  
  try {
    if (fs.existsSync(serverStatePath)) {
      fs.unlinkSync(serverStatePath);
    }
  } catch (error) {
    console.error('Failed to clean up server state:', error);
  }
});

console.log('Server running - press Ctrl+C to stop');
`;

    fs.writeFileSync(
      path.join(nptDir, 'start-server.js'),
      starterScript
    );
    
    const tasksConfig = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": "build",
          "type": "shell",
          "command": "npt build",
          "group": {
            "kind": "build",
            "isDefault": true
          },
          "presentation": {
            "reveal": "always",
            "panel": "shared"
          },
          "problemMatcher": {
            "owner": "pawn",
            "fileLocation": ["relative", "${workspaceFolder}"],
            "pattern": {
              "regexp": "^(.+)\\((\\d+)\\) : (warning|error) (\\d+): (.*)$",
              "file": 1,
              "line": 2,
              "severity": 3,
              "code": 4,
              "message": 5
            }
          }
        }
      ]
    };

    fs.writeFileSync(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(tasksConfig, null, 2)
    );
    
    const launchConfig = {
      "version": "0.2.0",
      "configurations": [
        {
          "name": "Start Server",
          "type": "node",
          "request": "launch",
          "program": "${workspaceFolder}/.npt/start-server.js",
          "console": "integratedTerminal",
          "internalConsoleOptions": "neverOpen"
        }
      ]
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'launch.json'),
      JSON.stringify(launchConfig, null, 2)
    );
    
    const settingsConfig = {
      "files.associations": {
        "*.pwn": "pawn",
        "*.inc": "pawn"
      },
      "editor.tabSize": 4,
      "editor.detectIndentation": false,
      "editor.insertSpaces": true,
      "[pawn]": {
        "editor.wordWrap": "off",
        "files.encoding": "windows1252"
      }
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settingsConfig, null, 2)
    );
    
    vscodeSpinner.success('VS Code configuration created');
  } catch (error) {
    vscodeSpinner.error(`Could not set up VS Code integration: ${error instanceof Error ? error.message : 'unknown error'}`);
    throw error;
  }
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .action(async (options) => {
      try {
        // Start with a simple message - no spinner yet
        console.log('Initializing new open.mp project...');
       
        // Get all user input first, with no spinners
        const answers = await promptForMissingOptions(options);
       
        // Now that we have all user input, we can start using spinners
        console.log('\nSetting up your project...');
        
        const manifestSpinner = new Spinner();
        manifestSpinner.start('Creating project manifest...');
        await generatePackageManifest(answers);
        manifestSpinner.success('Created pawn.json manifest file');
       
        const dirSpinner = new Spinner();
        dirSpinner.start('Setting up project directories...');
        const directories = ['gamemodes', 'filterscripts', 'includes', 'plugins', 'scriptfiles'];
        for (const dir of directories) {
          const dirPath = path.join(process.cwd(), dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
        }
        dirSpinner.success('Project directories created');
       
        const gamemodeFile = path.join(process.cwd(), 'gamemodes', `${answers.name}.pwn`);
        if (!fs.existsSync(gamemodeFile)) {
          const codeSpinner = new Spinner();
          codeSpinner.start(`Creating ${answers.projectType} code...`);
          
          let templateContent = '';
          if (answers.projectType === 'gamemode') {
            templateContent = generateGamemodeTemplate(answers.name);
          } else if (answers.projectType === 'filterscript') {
            templateContent = generateFilterscriptTemplate(answers.name);
          } else {
            templateContent = generateLibraryTemplate();
          }

          let filePath = gamemodeFile;
          if (answers.projectType === 'filterscript') {
            filePath = path.join(process.cwd(), 'filterscripts', `${answers.name}.pwn`);
          } else if (answers.projectType === 'library') {
            filePath = path.join(process.cwd(), 'includes', `${answers.name}.inc`);
          }

          const parentDir = path.dirname(filePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          fs.writeFileSync(filePath, templateContent);
          codeSpinner.success(`Created ${answers.projectType} file: ${path.relative(process.cwd(), filePath)}`);
        }

        if (answers.initGit) {
          const gitSpinner = new Spinner();
          gitSpinner.start('Initializing Git repository...');
          try {
            await initGitRepository();
            gitSpinner.success('Git repository initialized');
          } catch (error) {
            gitSpinner.error(`Could not initialize Git repository: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }

        if (answers.editor === 'VS Code') {
          try {
            await setupVSCodeIntegration(answers.name);
          } catch (error) {
            // Error handling is inside the function
          }
        }

        const prefSpinner = new Spinner();
        prefSpinner.start('Saving user preferences...');
        try {
          const preferencesDir = path.join(os.homedir(), '.npt');
          if (!fs.existsSync(preferencesDir)) {
            fs.mkdirSync(preferencesDir, { recursive: true });
          }
          
          const preferencesPath = path.join(preferencesDir, 'preferences.json');
          const preferences = {
            editor: answers.editor
          };
          
          fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
          prefSpinner.success('User preferences saved');
        } catch (error) {
          prefSpinner.error(`Failed to save editor preferences: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        if (answers.author && answers.author !== configManager.getDefaultAuthor()) {
          configManager.setDefaultAuthor(answers.author);
        }

        if (answers.downloadServer) {
          try {
            await downloadOpenMPServer('latest', directories);
          } catch (error) {
            // Error handling is inside the function
          }
        }

        const configSpinner = new Spinner();
        configSpinner.start('Updating server configuration...');
        try {
          const configPath = path.join(process.cwd(), 'config.json');
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            if (config.pawn && Array.isArray(config.pawn.main_scripts)) {
              config.pawn.main_scripts = [`${answers.name} 1`];
              
              if (config.name === "open.mp server") {
                config.name = `${answers.name} | open.mp server`;
              }
              
              fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
              configSpinner.success('Server configuration updated');
            } else {
              configSpinner.success('No configuration update needed');
            }
          } else {
            configSpinner.warning('No server configuration found');
          }
        } catch (error) {
          configSpinner.error(`Could not update config.json: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        const showSuccessInfo = () => {
          logger.success('\n🎉 Project initialized successfully!');
          logger.info('\nNext steps:');
          logger.info(`  1. Edit your ${answers.projectType} in ${answers.projectType === 'gamemode' ? 'gamemodes/' : answers.projectType === 'filterscript' ? 'filterscripts/' : 'includes/'}${answers.name}.${answers.projectType === 'library' ? 'inc' : 'pwn'}`);
          logger.info('  2. Run "npt build" to compile your code');
          if (answers.editor === 'VS Code') {
            logger.info('  3. Press Ctrl+Shift+B in VS Code to run the build task');
            logger.info('  4. Press F5 to start the server');
          }
          if (answers.initGit) {
            logger.info(`  ${answers.editor === 'VS Code' ? '5' : '4'}. Use ${answers.editor === 'VS Code' ? 'VS Code\'s built-in Git tools' : 'Git commands'} to push to GitHub or another Git provider`);
          }
        };

        setTimeout(() => {
          const cleanupSpinner = new Spinner();
          cleanupSpinner.start('Performing final cleanup...');
          
          const workingFile = `${answers.name}.pwn`;
          cleanupGamemodeFiles(workingFile);
          
          const qawnoDir = path.join(process.cwd(), 'qawno');
          
          const keepItems = ['include', 'pawncc.exe', 'pawnc.dll'];
          const removedCount = cleanupFiles(qawnoDir, keepItems);
          
          if (removedCount > 0) {
            cleanupSpinner.update(`Cleaned up qawno directory (removed ${removedCount} items)`);
          }
          
          const extractDir = path.join(process.cwd(), 'temp_extract');
          if (fs.existsSync(extractDir)) {
            let retryCount = 0;
            const maxRetries = 3;
            const retryInterval = 2000;
            
            const attemptRemoval = () => {
              try {
                fs.rmSync(extractDir, { recursive: true, force: true });
                cleanupSpinner.success('Cleanup complete');
                
                showSuccessInfo();
                process.exit(0);
              } catch (err) {
                retryCount++;
                if (retryCount < maxRetries) {
                  cleanupSpinner.update(`Cleanup in progress (attempt ${retryCount}/${maxRetries})`);
                  setTimeout(attemptRemoval, retryInterval);
                } else {
                  cleanupSpinner.warning(`Could not remove extract directory after ${maxRetries} attempts`);
                  logger.info('You may need to manually delete the temp_extract directory later');
                  
                  showSuccessInfo();
                  process.exit(0);
                }
              }
            };
            
            attemptRemoval();
          } else {
            cleanupSpinner.success('Cleanup complete');
            showSuccessInfo();
            process.exit(0);
          }
        }, 1000);
       
      } catch (error) {
        logger.error(`Failed to initialize project: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

async function promptForMissingOptions(options: any): Promise<ProjectAnswers> {
  const defaultAuthor = configManager.getDefaultAuthor();
  
  const name = options.name || await input({
    message: 'Project name:',
    default: path.basename(process.cwd())
  });
  
  const description = options.description || await input({
    message: 'Project description:',
  });
  
  const author = options.author || await input({
    message: 'Author:',
    default: defaultAuthor || ''
  });
  
  const projectType = await select({
    message: 'Project type:',
    choices: [
      { value: 'gamemode', name: 'gamemode' },
      { value: 'filterscript', name: 'filterscript' },
      { value: 'library', name: 'library' }
    ],
    default: 'gamemode'
  }) as 'gamemode' | 'filterscript' | 'library';
  
  const editor = await select({
    message: 'Which editor are you using?',
    choices: [
      { value: 'VS Code', name: 'VS Code' },
      { value: 'Sublime Text', name: 'Sublime Text' },
      { value: 'Other/None', name: 'Other/None' }
    ],
    default: 'VS Code'
  }) as 'VS Code' | 'Sublime Text' | 'Other/None';
  
  const initGit = await confirm({
    message: 'Initialize Git repository?',
    default: true
  });

  const downloadServer = await confirm({
    message: 'Add open.mp server package?',
    default: true
  });
 
  return {
    name,
    description,
    author,
    projectType,
    addStdLib: true,
    initGit,
    downloadServer,
    editor
  } as ProjectAnswers;
}

async function initGitRepository(): Promise<void> {
  try {
    const git = simpleGit();
    await git.init();
    
    try {
      const gitignoreContent = `
# Compiled PAWN files
*.amx

# Log files
*.log

# Generated server files
server.cfg
server-crash.log

# Runtime directories
scriptfiles/
log/

# Dependencies directory
dependencies/

# IDE files
.vscode/
.idea/
*.sublime-project
*.sublime-workspace
`;
      
      fs.writeFileSync(path.join(process.cwd(), '.gitignore'), gitignoreContent.trim());
      logger.routine('Created .gitignore file with common PAWN-specific entries');
      
      try {
        await git.add('.');
        await git.commit('Initial commit: Initialize project structure', {'--no-gpg-sign': null});
        logger.routine('Created initial Git commit');
      } catch (commitError) {
        logger.warn('Could not create initial commit. You may need to commit the changes manually.');
        logger.warn(`Git commit error: ${commitError instanceof Error ? commitError.message : 'unknown error'}`);
      }
    } catch (gitignoreError) {
      logger.warn(`Could not create .gitignore file: ${gitignoreError instanceof Error ? gitignoreError.message : 'unknown error'}`);
    }
    
  } catch (error) {
    logger.warn('Failed to initialize Git repository. Git features will be disabled.');
    logger.warn(`Git error: ${error instanceof Error ? error.message : 'unknown error'}`);
    throw error;
  }
}

async function downloadOpenMPServer(versionInput: string, directories: string[]): Promise<void> {
  const spinner = new Spinner();
  spinner.start('Fetching latest open.mp version...');
  
  try {
    const version = versionInput === 'latest' ? await getLatestOpenMPVersion() : versionInput;
    spinner.success(`Found open.mp version ${version}`);
    
    const platform = process.platform;
    let downloadUrl = '';
    let filename = '';
    
    if (platform === 'win32') {
      downloadUrl = `https://github.com/openmultiplayer/open.mp/releases/download/${version}/open.mp-win-x86.zip`;
      filename = 'open.mp-win-x86.zip';
    } else if (platform === 'linux') {
      downloadUrl = `https://github.com/openmultiplayer/open.mp/releases/download/${version}/open.mp-linux-x86.tar.gz`;
      filename = 'open.mp-linux-x86.tar.gz';
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    logger.routine(`Downloading from ${downloadUrl}`);
    await downloadFileWithProgress(downloadUrl, filename);
    
    const extractSpinner = new Spinner();
    extractSpinner.start('Extracting server package...');
    await extractServerPackage(path.join(process.cwd(), filename), directories);
    extractSpinner.success('Server package extracted successfully');
    
    logger.success('Server installation complete!');
    
  } catch (error) {
    spinner.error(`Failed to download server package: ${error instanceof Error ? error.message : 'unknown error'}`);
    logger.info('You can download the server package manually from https://github.com/openmultiplayer/open.mp/releases');
    throw error;
  }
}

async function downloadFileWithProgress(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(process.cwd(), filename);
    const file = fs.createWriteStream(filePath);
    
    const progressBar = new cliProgress.SingleBar({
      format: 'Downloading [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} KB',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });
    
    let receivedBytes = 0;
    let totalBytes = 0;
    
    const req = https.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        if (response.headers.location) {
          logger.routine(`Following redirect to ${response.headers.location}`);
          
          req.destroy();
          
          const redirectReq = https.get(response.headers.location, { timeout: 10000 }, (redirectResponse) => {
            if (redirectResponse.headers['content-length']) {
              totalBytes = parseInt(redirectResponse.headers['content-length'], 10);
              progressBar.start(Math.floor(totalBytes / 1024), 0);
            }
            
            redirectResponse.pipe(file);
            
            redirectResponse.on('data', (chunk) => {
              receivedBytes += chunk.length;
              if (totalBytes > 0) {
                progressBar.update(Math.floor(receivedBytes / 1024));
              }
            });
            
            file.on('finish', () => {
              progressBar.stop();
              file.close();
              redirectReq.destroy();
              logger.routine(`Server package downloaded to ${filename}`);
              resolve();
            });
          }).on('error', (err) => {
            progressBar.stop();
            file.close();
            fs.unlink(filePath, () => {});
            reject(err);
          });
        }
      } else if (response.statusCode === 200) {
        if (response.headers['content-length']) {
          totalBytes = parseInt(response.headers['content-length'], 10);
          progressBar.start(Math.floor(totalBytes / 1024), 0);
        }
        
        response.pipe(file);
        
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            progressBar.update(Math.floor(receivedBytes / 1024));
          }
        });
        
        file.on('finish', () => {
          progressBar.stop();
          file.close();
          req.destroy();
          logger.routine(`Server package downloaded to ${filename}`);
          resolve();
        });
      } else {
        progressBar.stop();
        file.close();
        req.destroy();
        fs.unlink(filePath, () => {});
        reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      progressBar.stop();
      file.close();
      req.destroy();
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}
  
async function getLatestOpenMPVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.github.com/repos/openmultiplayer/open.mp/releases/latest', {
      headers: {
        'User-Agent': 'neufox-pawn-tools'
      },
      timeout: 10000
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          req.destroy();
          
          const release = JSON.parse(data);
          if (release.tag_name) {
            resolve(release.tag_name);
          } else {
            reject(new Error('Could not find latest version tag'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => {
      req.destroy();
      reject(err);
    });
  });
}

async function extractServerPackage(filePath: string, directories: string[]): Promise<void> {
  try {
    const extractDir = path.join(process.cwd(), 'temp_extract');
    
    if (fs.existsSync(extractDir)) {
      try {
        logger.detail(`Removing existing extract directory at ${extractDir}`);
        fs.rmSync(extractDir, { recursive: true, force: true });
        logger.detail('Successfully removed existing extract directory');
      } catch (err) {
        logger.warn(`Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`);
        logger.warn('Proceeding anyway, but cleanup may be incomplete');
      }
    }
    
    logger.routine(`Creating temporary extract directory at ${extractDir}`);
    fs.mkdirSync(extractDir, { recursive: true });
    
    if (filePath.endsWith('.zip')) {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractDir, true);
    } else if (filePath.endsWith('.tar.gz')) {
      const tar = require('tar');
      await tar.extract({
        file: filePath,
        cwd: extractDir
      });
    }
    
    const dirContents = fs.readdirSync(extractDir);
    let serverDirName = null;
    
    for (const item of dirContents) {
      if (item.toLowerCase() === 'server' && 
          fs.statSync(path.join(extractDir, item)).isDirectory()) {
        serverDirName = item;
        break;
      }
    }
    
    const copySpinner = new Spinner();
    copySpinner.start('Copying server files to project...');
    
    if (serverDirName) {
      const serverDir = path.join(extractDir, serverDirName);
      
      const files = fs.readdirSync(serverDir);
      let copiedFiles = 0;
      const totalFiles = files.length;
      
      for (const file of files) {
        const sourcePath = path.join(serverDir, file);
        const destPath = path.join(process.cwd(), file);
        
        copySpinner.update(`Copying server files: ${file} (${copiedFiles}/${totalFiles})`);
        
        if (fs.statSync(sourcePath).isDirectory() && directories.includes(file)) {
          const subFiles = fs.readdirSync(sourcePath);
          for (const subFile of subFiles) {
            const subSourcePath = path.join(sourcePath, subFile);
            const subDestPath = path.join(destPath, subFile);
            
            if (!fs.existsSync(subDestPath)) {
              try {
                if (fs.statSync(subSourcePath).isDirectory()) {
                  fs.cpSync(subSourcePath, subDestPath, { recursive: true });
                  logger.detail(`Copied directory: ${subFile} to ${file}/`);
                  copiedFiles++;
                } else {
                  fs.copyFileSync(subSourcePath, subDestPath);
                  logger.detail(`Copied file: ${subFile} to ${file}/`);
                  copiedFiles++;
                }
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(`Could not copy ${subSourcePath}: ${err.message}`);
                } else {
                  logger.warn(`Could not copy ${subSourcePath}: Unknown error`);
                }
              }
            }
          }
        } else if (!fs.existsSync(destPath)) {
          try {
            if (fs.statSync(sourcePath).isDirectory()) {
              fs.cpSync(sourcePath, destPath, { recursive: true });
              logger.detail(`Copied directory: ${file} to project root`);
              copiedFiles++;
            } else {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to project root`);
              copiedFiles++;
            }
          } catch (err) {
            if (err instanceof Error) {
              logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
            } else {
              logger.warn(`Could not copy ${sourcePath}: Unknown error`);
            }
          }
        }
      }
      
      copySpinner.success(`Copied ${copiedFiles} server files to project`);
    } else {
      copySpinner.warning('No "Server" folder found in the package. Attempting to use extracted contents directly.');
      
      const files = fs.readdirSync(extractDir);
      let copiedFiles = 0;
      
      for (const file of files) {
        const sourcePath = path.join(extractDir, file);
        const destPath = path.join(process.cwd(), file);
        
        if (file.startsWith('.') || file === '__MACOSX') {
          continue;
        }
        
        if (fs.statSync(sourcePath).isDirectory() && directories.includes(file)) {
          const subFiles = fs.readdirSync(sourcePath);
          for (const subFile of subFiles) {
            const subSourcePath = path.join(sourcePath, subFile);
            const subDestPath = path.join(destPath, subFile);
            
            if (!fs.existsSync(subDestPath)) {
              try {
                if (fs.statSync(subSourcePath).isDirectory()) {
                  fs.cpSync(subSourcePath, subDestPath, { recursive: true });
                  logger.detail(`Copied directory: ${subFile} to ${file}/`);
                  copiedFiles++;
                } else {
                  fs.copyFileSync(subSourcePath, subDestPath);
                  logger.detail(`Copied file: ${subFile} to ${file}/`);
                  copiedFiles++;
                }
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(`Could not copy ${subSourcePath}: ${err.message}`);
                } else {
                  logger.warn(`Could not copy ${subSourcePath}: Unknown error`);
                }
              }
            }
          }
        } else if (!fs.existsSync(destPath)) {
          try {
            if (fs.statSync(sourcePath).isDirectory()) {
              fs.cpSync(sourcePath, destPath, { recursive: true });
              logger.detail(`Copied directory: ${file} to project root`);
              copiedFiles++;
            } else {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to project root`);
              copiedFiles++;
            }
          } catch (err) {
            if (err instanceof Error) {
              logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
            } else {
              logger.warn(`Could not copy ${sourcePath}: Unknown error`);
            }
          }
        }
      }
      
      copySpinner.success(`Copied ${copiedFiles} server files to project`);
    }
    
    const cleanupSpinner = new Spinner();
    cleanupSpinner.start('Cleaning up downloaded files...');
    try {
      fs.unlinkSync(filePath);
      cleanupSpinner.success('Cleaned up downloaded package file');
    } catch (err) {
      if (err instanceof Error) {
        cleanupSpinner.error(`Could not delete ${filePath}: ${err.message}`);
      } else {
        cleanupSpinner.error(`Could not delete ${filePath}: Unknown error`);
      }
    }
    
  } catch (error) {
    logger.error(`Failed to extract server package: ${error instanceof Error ? error.message : 'unknown error'}`);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      // Silently ignore cleanup failure
    }
    throw error;
  }
}
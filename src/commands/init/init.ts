import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import ora from 'ora';
import * as cliProgress from 'cli-progress';
import { logger } from '../../utils/logger';
import { generatePackageManifest } from '../../core/manifest';
import { input, select, confirm } from '@inquirer/prompts';
import simpleGit from 'simple-git';
import { configManager } from '../../utils/config';
import { showBanner } from '../../utils/banner';

interface ProjectAnswers {
  name: string;
  description: string;
  author: string;
  projectType: 'gamemode' | 'filterscript' | 'library';
  addStdLib: boolean;
  initGit: boolean;
  downloadServer: boolean;
  editor: 'VS Code' | 'Sublime Text' | 'Other/None';
  downloadCompiler: boolean;
  compilerVersion: string;
}

function getTemplatePath(type: string): string {
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
  const projectTemplatesDir = path.join(templatesDir, 'projects');

  switch (type) {
    case 'gamemode':
      return path.join(projectTemplatesDir, 'gamemode.pwn');
    case 'filterscript':
      return path.join(projectTemplatesDir, 'filterscript.pwn');
    case 'library':
      return path.join(projectTemplatesDir, 'library.inc');
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

function readTemplate(type: string, name: string): string {
  const templatePath = getTemplatePath(type);

  try {
    let template = fs.readFileSync(templatePath, 'utf8');

    template = template.replace(/\{\{name\}\}/g, name);

    return template;
  } catch (error) {
    logger.error(
      `Failed to read template file: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
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

        logger.detail(
          `Removed ${isDir ? 'directory' : 'file'}: ${directory}/${entry}`
        );
        removedCount++;
      } catch (err) {
        logger.warn(
          `Failed to remove ${entryPath}: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }

    return removedCount;
  } catch (err) {
    logger.warn(
      `Could not access directory ${directory}: ${err instanceof Error ? err.message : 'unknown error'}`
    );
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
      if (
        entry === workingFile ||
        entry === `${path.parse(workingFile).name}.inc`
      ) {
        continue;
      }

      if (entry.endsWith('.pwn') || entry.endsWith('.amx')) {
        const filePath = path.join(gamemodesDir, entry);

        try {
          fs.unlinkSync(filePath);
          logger.detail(`Removed gamemode file: ${entry}`);
          removedCount++;
        } catch (err) {
          logger.warn(
            `Failed to remove ${filePath}: ${err instanceof Error ? err.message : 'unknown error'}`
          );
        }
      }
    }

    if (removedCount > 0) {
      logger.routine(
        `Cleaned up gamemodes directory (removed ${removedCount} files)`
      );
    }
  } catch (err) {
    logger.warn(
      `Could not access gamemode directory: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

async function setupVSCodeIntegration(__projectName: string): Promise<void> {
  const vscodeSpinner = ora('Setting up VS Code integration...').start();
  try {
    const vscodeDir = path.join(process.cwd(), '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const pawnctlDir = path.join(process.cwd(), '.pawnctl');
    if (!fs.existsSync(pawnctlDir)) {
      fs.mkdirSync(pawnctlDir, { recursive: true });
    }

    // get the starter script from main templates directory
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'common',
      'start-server.js'
    );
    const targetPath = path.join(pawnctlDir, 'start-server.js');

    fs.copyFileSync(templatePath, targetPath);
    logger.detail(`Copied start-server.js template to ${targetPath}`);

    // get vscode config files from folder templates/vscode
    const tasksConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'tasks.json'
    );
    const launchConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'launch.json'
    );
    const settingsConfigPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'vscode',
      'settings.json'
    );

    fs.copyFileSync(tasksConfigPath, path.join(vscodeDir, 'tasks.json'));
    logger.detail('Copied tasks.json template');

    fs.copyFileSync(launchConfigPath, path.join(vscodeDir, 'launch.json'));
    logger.detail('Copied launch.json template');

    fs.copyFileSync(settingsConfigPath, path.join(vscodeDir, 'settings.json'));
    logger.detail('Copied settings.json template');

    vscodeSpinner.succeed('VS Code configuration created');
  } catch (error) {
    vscodeSpinner.fail(
      `Could not set up VS Code integration: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

export default function (program: Command): void {
  program
    .command('init')
    .description('Initialize a new open.mp project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --description <description>', 'project description')
    .option('-a, --author <author>', 'project author')
    .action(async (options) => {
      showBanner(false);
      try {
        // Start with a simple message - no spinner yet
        console.log('Initializing new open.mp project...');

        // Get all user input first, with no spinners
        const answers = await promptForMissingOptions(options);

        // Now that we have all user input, we can start using spinners
        console.log('\nSetting up your project...');

        const manifestSpinner = ora('Creating project manifest...').start();
        await generatePackageManifest(answers);
        manifestSpinner.succeed('Created pawn.json manifest file');

        const dirSpinner = ora('Setting up project directories...').start();
        const directories = [
          'gamemodes',
          'filterscripts',
          'includes',
          'plugins',
          'scriptfiles',
        ];
        for (const dir of directories) {
          const dirPath = path.join(process.cwd(), dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
        }
        dirSpinner.succeed('Project directories created');

        const gamemodeFile = path.join(
          process.cwd(),
          'gamemodes',
          `${answers.name}.pwn`
        );
        if (!fs.existsSync(gamemodeFile)) {
          const codeSpinner = ora(
            `Creating ${answers.projectType} code...`
          ).start();

          try {
            const templateContent = readTemplate(
              answers.projectType,
              answers.name
            );

            let filePath = gamemodeFile;
            if (answers.projectType === 'filterscript') {
              filePath = path.join(
                process.cwd(),
                'filterscripts',
                `${answers.name}.pwn`
              );
            } else if (answers.projectType === 'library') {
              filePath = path.join(
                process.cwd(),
                'includes',
                `${answers.name}.inc`
              );
            }

            const parentDir = path.dirname(filePath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }

            fs.writeFileSync(filePath, templateContent);
            codeSpinner.succeed(
              `Created ${answers.projectType} file: ${path.relative(process.cwd(), filePath)}`
            );
          } catch (error) {
            codeSpinner.fail(
              `Failed to create ${answers.projectType} file: ${error instanceof Error ? error.message : 'unknown error'}`
            );
          }
        }

        if (answers.initGit) {
          const gitSpinner = ora('Initializing Git repository...').start();
          try {
            await initGitRepository();
            gitSpinner.succeed('Git repository initialized');
          } catch (error) {
            gitSpinner.fail(
              `Could not initialize Git repository: ${error instanceof Error ? error.message : 'unknown error'}`
            );
          }
        }

        if (answers.editor === 'VS Code') {
          try {
            await setupVSCodeIntegration(answers.name);
          } catch (_error) {
            void _error; // Error handling is inside the function
          }
        }

        const prefSpinner = ora('Saving user preferences...').start();
        try {
          const preferencesDir = path.join(os.homedir(), '.pawnctl');
          if (!fs.existsSync(preferencesDir)) {
            fs.mkdirSync(preferencesDir, { recursive: true });
          }

          const preferencesPath = path.join(preferencesDir, 'preferences.json');
          const preferences = {
            editor: answers.editor,
          };

          fs.writeFileSync(
            preferencesPath,
            JSON.stringify(preferences, null, 2)
          );
          prefSpinner.succeed('User preferences saved');
        } catch (error) {
          prefSpinner.fail(
            `Failed to save editor preferences: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }

        if (
          answers.author &&
          answers.author !== configManager.getDefaultAuthor()
        ) {
          configManager.setDefaultAuthor(answers.author);
        }

        if (answers.downloadServer) {
          try {
            await downloadOpenMPServer('latest', directories);
          } catch (_error) {
            void _error; // Error handling is inside the function
          }
        }

        if (answers.downloadCompiler) {
          try {
            await downloadCompiler(answers.compilerVersion);
          } catch (_error) {
            void _error; // Error handling is inside the function
          }
        }

        const configSpinner = ora('Updating server configuration...').start();
        try {
          const configPath = path.join(process.cwd(), 'config.json');
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);

            if (config.pawn && Array.isArray(config.pawn.main_scripts)) {
              config.pawn.main_scripts = [`${answers.name} 1`];

              if (config.name === 'open.mp server') {
                config.name = `${answers.name} | open.mp server`;
              }

              fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
              configSpinner.succeed('Server configuration updated');
            } else {
              configSpinner.info('No configuration update needed');
            }
          } else {
            configSpinner.info('No server configuration found');
          }
        } catch (error) {
          configSpinner.fail(
            `Could not update config.json: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }

        const showSuccessInfo = () => {
          logger.success('\n🎉 Project initialized successfully!');
          logger.info('\nNext steps:');
          logger.info(
            `  1. Edit your ${answers.projectType} in ${answers.projectType === 'gamemode' ? 'gamemodes/' : answers.projectType === 'filterscript' ? 'filterscripts/' : 'includes/'}${answers.name}.${answers.projectType === 'library' ? 'inc' : 'pwn'}`
          );
          logger.info('  2. Run "pawnctl build" to compile your code');
          if (answers.editor === 'VS Code') {
            logger.info(
              '  3. Press Ctrl+Shift+B in VS Code to run the build task'
            );
            logger.info('  4. Press F5 to start the server');
          }
          if (answers.initGit) {
            logger.info(
              `  ${answers.editor === 'VS Code' ? '5' : '4'}. Use ${answers.editor === 'VS Code' ? "VS Code's built-in Git tools" : 'Git commands'} to push to GitHub or another Git provider`
            );
          }
        };

        setTimeout(() => {
          const cleanupSpinner = ora('Performing final cleanup...').start();

          const workingFile = `${answers.name}.pwn`;
          cleanupGamemodeFiles(workingFile);

          const qawnoDir = path.join(process.cwd(), 'qawno');

          const keepItems = ['include', 'pawncc.exe', 'pawnc.dll'];
          const removedCount = cleanupFiles(qawnoDir, keepItems);

          if (removedCount > 0) {
            cleanupSpinner.text = `Cleaned up qawno directory (removed ${removedCount} items)`;
          }

          const extractDir = path.join(process.cwd(), 'temp_extract');
          if (fs.existsSync(extractDir)) {
            let retryCount = 0;
            const maxRetries = 3;
            const retryInterval = 2000;

            const attemptRemoval = () => {
              try {
                fs.rmSync(extractDir, { recursive: true, force: true });
                cleanupSpinner.succeed('Cleanup complete');

                showSuccessInfo();
                process.exit(0);
              } catch {
                retryCount++;
                if (retryCount < maxRetries) {
                  cleanupSpinner.text = `Cleanup in progress (attempt ${retryCount}/${maxRetries})`;
                  setTimeout(attemptRemoval, retryInterval);
                } else {
                  cleanupSpinner.warn(
                    `Could not remove extract directory after ${maxRetries} attempts`
                  );
                  logger.info(
                    'You may need to manually delete the temp_extract directory later'
                  );

                  showSuccessInfo();
                  process.exit(0);
                }
              }
            };

            attemptRemoval();
          } else {
            cleanupSpinner.succeed('Cleanup complete');
            showSuccessInfo();
            process.exit(0);
          }
        }, 1000);
      } catch (error) {
        logger.error(
          `Failed to initialize project: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

interface CommandOptions {
  name?: string;
  description?: string;
  author?: string;
}

async function promptForMissingOptions(
  options: CommandOptions
): Promise<ProjectAnswers> {
  const defaultAuthor = configManager.getDefaultAuthor();

  const name =
    options.name ||
    (await input({
      message: 'Project name:',
      default: path.basename(process.cwd()),
    }));

  const description =
    options.description ||
    (await input({
      message: 'Project description:',
    }));

  const author =
    options.author ||
    (await input({
      message: 'Author:',
      default: defaultAuthor || '',
    }));

  const projectType = (await select({
    message: 'Project type:',
    choices: [
      { value: 'gamemode', name: 'gamemode' },
      { value: 'filterscript', name: 'filterscript' },
      { value: 'library', name: 'library' },
    ],
    default: 'gamemode',
  })) as 'gamemode' | 'filterscript' | 'library';

  const editor = (await select({
    message: 'Which editor are you using?',
    choices: [
      { value: 'VS Code', name: 'VS Code' },
      { value: 'Sublime Text', name: 'Sublime Text' },
      { value: 'Other/None', name: 'Other/None' },
    ],
    default: 'VS Code',
  })) as 'VS Code' | 'Sublime Text' | 'Other/None';

  const initGit = await confirm({
    message: 'Initialize Git repository?',
    default: true,
  });

  const downloadServer = await confirm({
    message: 'Add open.mp server package?',
    default: true,
  });

  let downloadCompiler = true;
  if (process.platform !== 'linux') {
    downloadCompiler = await confirm({
      message: 'Download community pawn compiler?',
      default: true,
    });
  }

  let compilerVersion: string = 'latest';
  if (downloadCompiler) {
    compilerVersion = await input({
      message:
        'Enter the compiler version (or "latest" for the latest version):',
      default: 'latest',
    });
  }

  return {
    name,
    description,
    author,
    projectType,
    addStdLib: true,
    initGit,
    downloadServer,
    editor,
    downloadCompiler,
    compilerVersion,
  };
}

async function initGitRepository(): Promise<void> {
  try {
    const git = simpleGit();
    await git.init();

    try {
      const gitignoreTemplatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'common',
        'gitignore.txt'
      );

      if (!fs.existsSync(gitignoreTemplatePath)) {
        throw new Error(
          `Gitignore template not found at: ${gitignoreTemplatePath}`
        );
      }

      const gitignoreContent = fs.readFileSync(gitignoreTemplatePath, 'utf8');
      logger.detail(`Using gitignore template from: ${gitignoreTemplatePath}`);

      fs.writeFileSync(
        path.join(process.cwd(), '.gitignore'),
        gitignoreContent.trim()
      );
      logger.routine(
        'Created .gitignore file with common PAWN-specific entries'
      );

      try {
        await git.add('.');
        await git.commit('Initial commit: Initialize project structure', {
          '--no-gpg-sign': null,
        });
        logger.routine('Created initial Git commit');
      } catch (commitError) {
        logger.warn(
          'Could not create initial commit. You may need to commit the changes manually.'
        );
        logger.warn(
          `Git commit error: ${commitError instanceof Error ? commitError.message : 'unknown error'}`
        );
      }
    } catch (gitignoreError) {
      logger.warn(
        `Could not create .gitignore file: ${gitignoreError instanceof Error ? gitignoreError.message : 'unknown error'}`
      );
    }
  } catch (error) {
    logger.warn(
      'Failed to initialize Git repository. Git features will be disabled.'
    );
    logger.warn(
      `Git error: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

async function downloadOpenMPServer(
  versionInput: string,
  directories: string[]
): Promise<void> {
  const spinner = ora('Fetching latest open.mp version...').start();

  try {
    const version =
      versionInput === 'latest' ? await getLatestOpenMPVersion() : versionInput;
    spinner.succeed(`Found open.mp version ${version}`);

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

    const extractSpinner = ora('Extracting server package...').start();
    await extractServerPackage(path.join(process.cwd(), filename), directories);
    extractSpinner.succeed('Server package extracted successfully');

    logger.success('Server installation complete!');
  } catch (error) {
    spinner.fail(
      `Failed to download server package: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    logger.info(
      'You can download the server package manually from https://github.com/openmultiplayer/open.mp/releases'
    );
    throw error;
  }
}

async function downloadCompiler(versionInput: string) {
  let version =
    versionInput === 'latest' ? await getLatestCompilerVersion() : versionInput;

  if (version.startsWith('v')) {
    version = version.substring(1);
  }

  const compilerTmpDir = path.join(process.cwd(), 'compiler_temp');
  if (fs.existsSync(compilerTmpDir)) {
    try {
      logger.detail(`Removing existing extract directory at ${compilerTmpDir}`);
      fs.rmSync(compilerTmpDir, { recursive: true, force: true });
      logger.detail('Successfully removed existing extract directory');
    } catch (err) {
      logger.warn(
        `Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      logger.warn('Proceeding anyway, but cleanup may be incomplete');
    }
  }
  logger.routine(`Creating temporary extract directory at ${compilerTmpDir}`);
  fs.mkdirSync(compilerTmpDir, { recursive: true });

  let downloadUrl: string, filename: string;
  switch (process.platform) {
    case 'win32': {
      downloadUrl = `https://github.com/pawn-lang/compiler/releases/download/v${version}/pawnc-${version}-windows.zip`;
      filename = `pawnc-${version}-windows.zip`;
      break;
    }
    case 'linux': {
      downloadUrl = `https://github.com/pawn-lang/compiler/releases/download/v${version}/pawnc-${version}-linux.tar.gz`;
      filename = `pawnc-${version}-linux.tar.gz`;
      break;
    }
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  const downloadCompilerSpinner = ora('Downloading compiler...').start();
  try {
    await downloadFileWithProgress(downloadUrl, `compiler_temp/${filename}`);
    downloadCompilerSpinner.succeed('Compiler downloaded successfully');
  } catch (error) {
    downloadCompilerSpinner.fail(
      `Failed to download compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      fs.rmSync(path.join(process.cwd(), 'compiler_temp'), {
        recursive: true,
        force: true,
      });
    } catch {
      //Silently ignore cleanup error
    }
    throw error;
  }

  const extractCompilerSpinner = ora('Extracting compiler...').start();
  try {
    await extractCompilerPackage(
      path.join(process.cwd(), 'compiler_temp', filename)
    );
    extractCompilerSpinner.succeed('Compiler extracted successfully');
  } catch (error) {
    extractCompilerSpinner.fail(
      `Failed to extract compiler: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }

  // Cleanup
  const cleanupCompilerSpinner = ora(
    'Cleaning up downloaded compiler files...'
  ).start();
  try {
    fs.rmSync(path.join(process.cwd(), 'compiler_temp'), {
      recursive: true,
      force: true,
    });
    cleanupCompilerSpinner.succeed('Cleaned up downloaded compiler folder');
  } catch (error) {
    cleanupCompilerSpinner.fail(
      `Failed to clean up compiler folder: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
}

async function downloadFileWithProgress(
  url: string,
  filename: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(process.cwd(), filename);
    const file = fs.createWriteStream(filePath);

    const progressBar = new cliProgress.SingleBar({
      format:
        'Downloading [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} KB',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    });

    let receivedBytes = 0;
    let totalBytes = 0;

    const req = https
      .get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            logger.routine(
              `Following redirect to ${response.headers.location}`
            );

            req.destroy();

            const redirectReq = https
              .get(
                response.headers.location,
                { timeout: 10000 },
                (redirectResponse) => {
                  if (redirectResponse.headers['content-length']) {
                    totalBytes = parseInt(
                      redirectResponse.headers['content-length'],
                      10
                    );
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
                }
              )
              .on('error', (err) => {
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
          reject(
            new Error(
              `Server responded with ${response.statusCode}: ${response.statusMessage}`
            )
          );
        }
      })
      .on('error', (err) => {
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
    const req = https
      .get(
        'https://api.github.com/repos/openmultiplayer/open.mp/releases/latest',
        {
          headers: {
            'User-Agent': 'pawnctl',
          },
          timeout: 10000,
        },
        (response) => {
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
        }
      )
      .on('error', (err) => {
        req.destroy();
        reject(err);
      });
  });
}

async function getLatestCompilerVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        'https://api.github.com/repos/pawn-lang/compiler/releases/latest',
        {
          headers: {
            'User-Agent': 'pawnctl',
          },
          timeout: 10000,
        },
        (response) => {
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
        }
      )
      .on('error', (err) => {
        req.destroy();
        reject(err);
      });
  });
}

async function extractServerPackage(
  filePath: string,
  directories: string[]
): Promise<void> {
  try {
    const extractDir = path.join(process.cwd(), 'temp_extract');

    if (fs.existsSync(extractDir)) {
      try {
        logger.detail(`Removing existing extract directory at ${extractDir}`);
        fs.rmSync(extractDir, { recursive: true, force: true });
        logger.detail('Successfully removed existing extract directory');
      } catch (err) {
        logger.warn(
          `Could not remove existing extract directory: ${err instanceof Error ? err.message : 'unknown error'}`
        );
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
        cwd: extractDir,
      });
    }

    const dirContents = fs.readdirSync(extractDir);
    let serverDirName = null;

    for (const item of dirContents) {
      if (
        item.toLowerCase() === 'server' &&
        fs.statSync(path.join(extractDir, item)).isDirectory()
      ) {
        serverDirName = item;
        break;
      }
    }

    const copyProgress = ora('Copying server files to project...').start();

    if (serverDirName) {
      const serverDir = path.join(extractDir, serverDirName);

      const files = fs.readdirSync(serverDir);
      let copiedFiles = 0;
      const totalFiles = files.length;

      for (const file of files) {
        const sourcePath = path.join(serverDir, file);
        const destPath = path.join(process.cwd(), file);

        copyProgress.text = `Copying server files: ${file} (${copiedFiles}/${totalFiles})`;

        if (
          fs.statSync(sourcePath).isDirectory() &&
          directories.includes(file)
        ) {
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
                  logger.warn(
                    `Could not copy ${subSourcePath}: ${err.message}`
                  );
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

      copyProgress.succeed(`Copied ${copiedFiles} server files to project`);
    } else {
      copyProgress.warn(
        'No "Server" folder found in the package. Attempting to use extracted contents directly.'
      );

      const files = fs.readdirSync(extractDir);
      const totalFiles = files.length;
      let copiedFiles = 0;

      for (const file of files) {
        const sourcePath = path.join(extractDir, file);
        const destPath = path.join(process.cwd(), file);

        copyProgress.text = `Copying server files: ${file} (${copiedFiles}/${totalFiles})`;

        if (file.startsWith('.') || file === '__MACOSX') {
          continue;
        }

        if (
          fs.statSync(sourcePath).isDirectory() &&
          directories.includes(file)
        ) {
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
                  logger.warn(
                    `Could not copy ${subSourcePath}: ${err.message}`
                  );
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

      copyProgress.succeed(`Copied ${copiedFiles} server files to project`);
    }

    const cleanupSpinner = ora('Cleaning up downloaded files...').start();
    try {
      fs.unlinkSync(filePath);
      cleanupSpinner.succeed('Cleaned up downloaded package file');
    } catch (err) {
      if (err instanceof Error) {
        cleanupSpinner.fail(`Could not delete ${filePath}: ${err.message}`);
      } else {
        cleanupSpinner.fail(`Could not delete ${filePath}: Unknown error`);
      }
    }
  } catch (error) {
    logger.error(
      `Failed to extract server package: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Silently ignore cleanup failure
    }
    throw error;
  }
}

async function extractCompilerPackage(filePath: string): Promise<void> {
  switch (process.platform) {
    case 'linux':
    case 'win32': {
      try {
        const extractDir = path.join(process.cwd(), 'compiler_temp');

        if (filePath.endsWith('.zip')) {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(filePath);
          zip.extractAllTo(extractDir, true);
        } else if (filePath.endsWith('.tar.gz')) {
          const tar = require('tar');
          await tar.extract({
            file: filePath,
            cwd: extractDir,
          });
        }

        try {
          fs.unlinkSync(filePath);
        } catch {
          // Silently ignore cleanup failure
        }

        //Get first and only folder in the extracted directory
        const folderName = fs.readdirSync(extractDir)[0];

        let copiedFiles = 0;

        if (!fs.existsSync(path.join(process.cwd(), 'compiler'))) {
          fs.mkdirSync(path.join(process.cwd(), 'compiler'), {
            recursive: true,
          });
          logger.detail(
            `Created compiler directory at ${path.join(process.cwd(), 'compiler')}`
          );
        }

        const copyProgress = ora(
          'Copying compiler files to project...'
        ).start();

        const binContents = fs.readdirSync(
          path.join(extractDir, folderName, 'bin')
        );
        for (const file of binContents) {
          const sourcePath = path.join(extractDir, folderName, 'bin', file);
          const destPath = path.join(process.cwd(), 'compiler', file);

          if (!fs.existsSync(destPath)) {
            try {
              fs.copyFileSync(sourcePath, destPath);
              logger.detail(`Copied file: ${file} to compiler/`);
              copiedFiles++;
            } catch (err) {
              if (err instanceof Error) {
                logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
              } else {
                logger.warn(`Could not copy ${sourcePath}: Unknown error`);
              }
            }
          }
        }

        if (process.platform == 'linux') {
          //Lib doesn't exist on Windows
          const libContents = fs.readdirSync(
            path.join(extractDir, folderName, 'lib')
          );
          for (const file of libContents) {
            const sourcePath = path.join(extractDir, folderName, 'lib', file);
            // const destPath = path.join("/usr/lib", file); //This requires SUDO privileges
            const destPath = path.join(process.cwd(), 'compiler', file);

            if (!fs.existsSync(destPath)) {
              try {
                fs.copyFileSync(sourcePath, destPath);
                // logger.detail(`Copied file: ${file} to /usr/lib`);
                logger.detail(`Copied file: ${file} to compiler/`);
                copiedFiles++;
              } catch (err) {
                if (err instanceof Error) {
                  logger.warn(`Could not copy ${sourcePath}: ${err.message}`);
                } else {
                  logger.warn(`Could not copy ${sourcePath}: Unknown error`);
                }
              }
            }
          }
        }

        copyProgress.succeed(`Copied ${copiedFiles} server files to compiler`);
      } catch (error) {
        logger.error(
          `Failed to extract compiler package: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        throw error;
      }
      break;
    }
    default:
      throw new Error(`Platform not implemented: ${process.platform}`);
  }
}

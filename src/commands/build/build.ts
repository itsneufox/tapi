import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { spawn } from 'child_process';
import { showBanner } from '../../utils/banner';
import { BuildProfile, PackageManifest } from '../../core/manifest';
import { getAddonManager } from '../../core/addons';

/**
 * Format compiler diagnostics consistently for console output.
 *
 * @param file - Source file path.
 * @param line - One-based line number for the problem.
 * @param severity - Diagnostic severity string.
 * @param code - Compiler error/warning code.
 * @param message - Diagnostic summary message.
 */
function formatProblem(
  file: string,
  line: number,
  severity: string,
  code: string,
  message: string
): string {
  return `${file}(${line}) : ${severity} ${code}: ${message}`;
}

/**
 * Merge build profile overrides with the base compiler configuration.
 *
 * @param baseConfig - Compiler config declared in pawn.json.
 * @param profile - Selected profile overrides.
 */
function mergeBuildProfile(
  baseConfig: PackageManifest['compiler'],
  profile: BuildProfile
): PackageManifest['compiler'] {
  if (!baseConfig) {
    throw new Error('Base compiler configuration is required');
  }

  return {
    input: profile.input || baseConfig.input,
    output: profile.output || baseConfig.output,
    includes: profile.includes || baseConfig.includes,
    options: profile.options || baseConfig.options,
  };
}

/**
 * Register the `build` command that compiles PAWN projects using pawncc.
 *
 * @param program - Commander instance to extend.
 */
export default function(program: Command): void {
  program
    .command('build')
    .description('Compile your PAWN code using pawncc')
    .option('-i, --input <file>', 'input .pwn file to compile')
    .option('-o, --output <file>', 'output .amx file')
    .option('-d, --debug <level>', 'debug level (1-3)', '3')
    .option('-p, --profile <profile>', 'build profile to use (dev, prod, test, etc.)')
    .option('--list-profiles', 'list available build profiles')
    .action(async (options) => {
      showBanner(false);

      try {
        logger.heading('Building PAWN project...');

        const manifestPath = path.join(process.cwd(), '.tapi', 'pawn.json');
        if (!fs.existsSync(manifestPath)) {
          logger.error('No pawn.json manifest found. Run "tapi init" first.');
          process.exit(1);
        }

        const manifest: PackageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Handle list profiles option
        if (options.listProfiles) {
          logger.info('Available build profiles:');
          if (manifest.compiler?.profiles) {
            for (const [name, profile] of Object.entries(manifest.compiler.profiles)) {
              logger.info(`  ${name}: ${profile.description || 'No description'}`);
              if (profile.options) {
                logger.detail(`    Options: ${profile.options.join(' ')}`);
              }
              if (profile.constants && Object.keys(profile.constants).length > 0) {
                const constants = Object.entries(profile.constants)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(', ');
                logger.detail(`    Constants: ${constants}`);
              }
            }
          } else {
            logger.info('  No profiles defined');
          }
          return;
        }

        // Handle build profile
        let compilerConfig = manifest.compiler;
        if (options.profile && manifest.compiler?.profiles?.[options.profile]) {
          const profile = manifest.compiler.profiles[options.profile];
          logger.info(`Using build profile: ${options.profile}`);
          if (profile.description) {
            logger.info(`   ${profile.description}`);
          }
          compilerConfig = mergeBuildProfile(manifest.compiler, profile);
        } else if (options.profile) {
          logger.error(`Build profile '${options.profile}' not found in pawn.json`);
          logger.info('Available profiles:');
          if (manifest.compiler?.profiles) {
            for (const [name, profile] of Object.entries(manifest.compiler.profiles)) {
              logger.info(`  ${name}: ${profile.description || 'No description'}`);
            }
          } else {
            logger.info('  No profiles defined');
          }
          process.exit(1);
        }

        const inputFile = options.input || compilerConfig?.input || manifest.entry;
        const outputFile = options.output || compilerConfig?.output || manifest.output;

        if (!inputFile) {
          logger.error('No input file specified. Use --input or define entry in pawn.json');
          process.exit(1);
        }

        if (!fs.existsSync(inputFile)) {
          logger.error(`Input file not found: ${inputFile}`);
          process.exit(1);
        }

        // Call addon preBuild hooks
        try {
          const addonManager = getAddonManager();
          const buildContext = {
            input: inputFile,
            output: outputFile || '',
            options: {
              debug: options.debug,
              profile: options.profile
            },
            success: false
          };
          
          await addonManager.getHookManager().executeHook('preBuild', buildContext);
        } catch (error) {
          logger.detail(`Addon preBuild hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }

        const args = [];

        if (outputFile) {
          args.push(`-o${outputFile}`);
        }

        args.push(`-d${options.debug}`);

        // Handle include directories - prioritize compiler directories only
        const includeDirectories = compilerConfig?.includes || [];

        // Add default include directories based on what exists
        const defaultIncludes = [];

        // Add pawno/include if pawno exists (SA-MP - highest priority)
        if (fs.existsSync(path.join(process.cwd(), 'pawno', 'include'))) {
          defaultIncludes.push('pawno/include');
        }

        // Add qawno/include if qawno exists (open.mp - second priority)
        if (fs.existsSync(path.join(process.cwd(), 'qawno', 'include'))) {
          defaultIncludes.push('qawno/include');
        }

        // Add compiler/include if compiler folder exists (community - third priority)
        if (fs.existsSync(path.join(process.cwd(), 'compiler', 'include'))) {
          defaultIncludes.push('compiler/include');
        }

        const allIncludes = [...new Set([...includeDirectories, ...defaultIncludes])];

        for (const includeDir of allIncludes) {
          if (fs.existsSync(includeDir)) {
            args.push(`-i${includeDir}`);
            logger.detail(`Added include directory: ${includeDir}`);
          } else {
            logger.detail(`Skipped non-existent include directory: ${includeDir}`);
          }
        }

        const compilerOptions = compilerConfig?.options || [
          '-;+',
          '-(+',
          '-\\+',
          '-Z+',
        ];
        args.push(...compilerOptions);

        // Constants are now handled in PAWN code using #define and #if defined()

        args.push(inputFile);

        const platform = process.platform;
        const exeExtension = platform === 'win32' ? '.exe' : '';

        const possibleCompilerPaths = [
          // Check pawno first (SA-MP server structure)
          [
            path.join(process.cwd(), 'pawno', `pawncc${exeExtension}`),
            path.join(process.cwd(), 'pawno'),
          ],
          // Then check qawno (open.mp server structure)
          [
            path.join(process.cwd(), 'qawno', `pawncc${exeExtension}`),
            path.join(process.cwd(), 'qawno'),
          ],
          // Then check separate compiler folder (community compiler)
          [
            path.join(process.cwd(), 'compiler', `pawncc${exeExtension}`),
            path.join(process.cwd(), 'compiler'),
          ],
          // Finally check project root
          [path.join(process.cwd(), `pawncc${exeExtension}`), process.cwd()],
        ];

        let compilerPath = null,
          libPath = null;
        for (const testPath of possibleCompilerPaths) {
          if (fs.existsSync(testPath[0])) {
            compilerPath = testPath[0];
            libPath = testPath[1];
            break;
          }
        }

        if (!compilerPath) {
          logger.error('Could not find pawncc compiler. Make sure it\'s in pawno, qawno, or compiler directory.');
          process.exit(1);
        }

        logger.routine(`Using compiler: ${compilerPath}`);
        logger.info(`Compiling: ${inputFile} -> ${outputFile || 'default output'}`);

        if (logger.getVerbosity() === 'verbose') {
          logger.detail('Compiler arguments:');
          for (const arg of args) {
            logger.detail(`  ${arg}`);
          }
        }

        let processEnv;
        if (process.platform === 'linux') {
          logger.routine('Setting LD_LIBRARY_PATH for compiler');
          processEnv = {
            ...process.env,
            LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ? `${process.env.LD_LIBRARY_PATH}:${libPath}` : libPath,
          };
        } else {
          processEnv = process.env;
        }

        const compiler = spawn(compilerPath, args, {
          env: processEnv as NodeJS.ProcessEnv,
        });

        let output = '';
        let _errorOutput = '';

        const errorPattern = /([^(]+)\((\d+)(?:-\d+)?\) : (warning|error) (\d+) : (.*)/;

        compiler.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;

          const lines = text.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const match = line.match(errorPattern);
              if (match) {
                const [, file, lineNum, severity, code, message] = match;
                logger.plain(formatProblem(file, parseInt(lineNum), severity, code, message));
              } else {
                logger.plain(line);
              }
            }
          }
        });

        compiler.stderr.on('data', (data) => {
          const text = data.toString();
          _errorOutput += text;

          const lines = text.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const match = line.match(errorPattern);
              if (match) {
                const [, file, lineNum, severity, code, message] = match;
                logger.plain(formatProblem(file, parseInt(lineNum), severity, code, message));
              } else {
                logger.error(line);
              }
            }
          }
        });

        compiler.on('close', async (code) => {
          const success = code === 0;
          
          // Call addon postBuild hooks
          try {
            const addonManager = getAddonManager();
            const buildContext = {
              input: inputFile,
              output: outputFile || '',
              options: {
                debug: options.debug,
                profile: options.profile
              },
              success: success,
              errors: success ? [] : ['Compilation failed']
            };
            
            await addonManager.getHookManager().executeHook('postBuild', buildContext);
          } catch (error) {
            logger.detail(`Addon postBuild hook failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          }

          if (success) {
            logger.newline();
            logger.finalSuccess('Compilation successful!');

            const successMatch = output.match(
              /Code\s*:\s*(\d+)\s*bytes\nData\s*:\s*(\d+)\s*bytes\nStack\/Heap\s*:\s*(\d+)\s*bytes\nEstimated usage\s*:\s*(\d+)\s*cells\nTotal requirements\s*:\s*(\d+)\s*bytes/
            );

            if (successMatch) {
              logger.newline();
              logger.subheading('Compilation statistics:');
              logger.keyValue('File', `${path.basename(inputFile || '')} (${successMatch[5]} bytes)`);
              logger.keyValue('Code', `${successMatch[1]} bytes`);
              logger.keyValue('Data', `${successMatch[2]} bytes`);
              logger.keyValue('Stack/Heap', `${successMatch[3]} bytes`);
              logger.keyValue('Estimated usage', `${successMatch[4]} cells`);
            }

            process.exit(0);
          } else {
            logger.newline();
            logger.error('Compilation failed!');
            process.exit(1);
          }
        });

        compiler.on('error', (error) => {
          logger.error(`Failed to start compiler: ${error.message}`);
          process.exit(1);
        });

      } catch (error) {
        logger.error(`Build error: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

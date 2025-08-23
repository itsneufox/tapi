import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { spawn } from 'child_process';
import { showBanner } from '../../utils/banner';

function formatProblem(
  file: string,
  line: number,
  severity: string,
  code: string,
  message: string
): string {
  return `${file}(${line}) : ${severity} ${code}: ${message}`;
}

export default function(program: Command): void {
  program
    .command('build')
    .description('Compile your PAWN code using pawncc')
    .option('-i, --input <file>', 'input .pwn file to compile')
    .option('-o, --output <file>', 'output .amx file')
    .option('-d, --debug <level>', 'debug level (1-3)', '3')
    .action(async (options) => {
      showBanner(false);
      try {
        logger.heading('Building PAWN project...');

        const manifestPath = path.join(process.cwd(), '.pawnctl', 'pawn.json');
        if (!fs.existsSync(manifestPath)) {
          logger.error('No pawn.json manifest found. Run "pawnctl init" first or create a manifest file.');
          process.exit(1);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        const inputFile = options.input || manifest.compiler?.input || manifest.entry;
        const outputFile = options.output || manifest.compiler?.output || manifest.output;

        if (!inputFile) {
          logger.error('No input file specified. Use --input or define entry/compiler.input in pawn.json');
          process.exit(1);
        }

        if (!fs.existsSync(inputFile)) {
          logger.error(`Input file not found: ${inputFile}`);
          process.exit(1);
        }

        const args = [];

        if (outputFile) {
          args.push(`-o${outputFile}`);
        }

        args.push(`-d${options.debug}`);

        // Handle include directories - prioritize compiler directories only
        const includeDirectories = manifest.compiler?.includes || [];

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

        const compilerOptions = manifest.compiler?.options || [
          '-;+',
          '-(+',
          '-\\+',
          '-Z+',
        ];
        args.push(...compilerOptions);

        const constants = manifest.compiler?.constants || {};
        for (const [key, value] of Object.entries(constants)) {
          args.push(`-D${key}=${value}`);
        }

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
          logger.error('Could not find pawncc compiler. Make sure it\'s in the pawno, qawno, or compiler directory.');
          process.exit(1);
        }

        logger.routine(`Using compiler: ${compilerPath}`);
        logger.info(`Compiling: ${inputFile} → ${outputFile || 'default output'}`);

        logger.detail('Compiler arguments:');
        for (const arg of args) {
          logger.detail(`  ${arg}`);
        }

        let processEnv;
        if (process.platform == 'linux') {
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

        compiler.on('close', (code) => {
          if (code === 0) {
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
        logger.error(`An error occurred during the build process: ${error instanceof Error ? error.message : 'unknown error'}`);
        process.exit(1);
      }
    });
}

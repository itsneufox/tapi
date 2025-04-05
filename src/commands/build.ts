import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";
import { spawn } from "child_process";

function formatProblem(
  file: string,
  line: number,
  severity: string,
  code: string,
  message: string,
): string {
  return `${file}(${line}) : ${severity} ${code}: ${message}`;
}

export function buildCommand(program: Command): void {
  program
    .command("build")
    .description("Compile your PAWN code using pawncc")
    .option("-i, --input <file>", "input .pwn file to compile")
    .option("-o, --output <file>", "output .amx file")
    .option("-d, --debug <level>", "debug level (1-3)", "3")
    .action(async (options) => {
      try {
        logger.info("Building PAWN project...");

        const manifestPath = path.join(process.cwd(), "pawn.json");
        if (!fs.existsSync(manifestPath)) {
          logger.error(
            'No pawn.json manifest found. Run "npt init" first or create a manifest file.',
          );
          process.exit(1);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

        const inputFile =
          options.input || manifest.compiler?.input || manifest.entry;
        const outputFile =
          options.output || manifest.compiler?.output || manifest.output;

        if (!inputFile) {
          logger.error(
            "No input file specified. Use --input or define entry/compiler.input in pawn.json",
          );
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

        const includeDirectories = manifest.compiler?.includes || ["includes"];
        for (const includeDir of includeDirectories) {
          args.push(`-i${includeDir}`);
        }

        const qawnoIncludeDir = path.join(process.cwd(), "qawno", "include");
        if (fs.existsSync(qawnoIncludeDir)) {
          args.push(`-i${qawnoIncludeDir}`);
        }

        const compilerOptions = manifest.compiler?.options || [
          "-;+",
          "-(+",
          "-\\+",
          "-Z+",
        ];
        args.push(...compilerOptions);

        const constants = manifest.compiler?.constants || {};
        for (const [key, value] of Object.entries(constants)) {
          args.push(`-D${key}=${value}`);
        }

        args.push(inputFile);

        const platform = process.platform;
        const exeExtension = platform === "win32" ? ".exe" : "";

        const possibleCompilerPaths = [
          path.join(process.cwd(), "qawno", `pawncc${exeExtension}`),
          path.join(process.cwd(), `pawncc${exeExtension}`),
          path.join(process.cwd(), "compiler", `pawncc${exeExtension}`),
        ];

        let compilerPath = null;
        for (const testPath of possibleCompilerPaths) {
          if (fs.existsSync(testPath)) {
            compilerPath = testPath;
            break;
          }
        }

        if (!compilerPath) {
          logger.error(
            'Could not find pawncc compiler. Make sure it\'s in the qawno directory, the project root, or a "compiler" folder.',
          );
          process.exit(1);
        }

        logger.routine(`Using compiler: ${compilerPath}`);
        logger.info(
          `Compiling: ${inputFile} → ${outputFile || "default output"}`,
        );

        logger.detail("Compiler arguments:");
        for (const arg of args) {
          logger.detail(`  ${arg}`);
        }

        const compiler = spawn(compilerPath, args);

        let output = "";
        let errorOutput = "";

        const errorPattern =
          /([^(]+)\((\d+)(?:-\d+)?\) : (warning|error) (\d+) : (.*)/;

        compiler.stdout.on("data", (data) => {
          const text = data.toString();
          output += text;

          const lines = text.split("\n");
          for (const line of lines) {
            const match = line.match(errorPattern);
            if (match) {
              const [, file, lineNum, severity, code, message] = match;
              console.log(
                formatProblem(file, parseInt(lineNum), severity, code, message),
              );
            } else {
              process.stdout.write(line + "\n");
            }
          }
        });

        compiler.stderr.on("data", (data) => {
          const text = data.toString();
          errorOutput += text;

          const lines = text.split("\n");
          for (const line of lines) {
            const match = line.match(errorPattern);
            if (match) {
              const [, file, lineNum, severity, code, message] = match;
              console.log(
                formatProblem(file, parseInt(lineNum), severity, code, message),
              );
            } else {
              process.stderr.write(line + "\n");
            }
          }
        });

        compiler.on("close", (code) => {
          if (code === 0) {
            logger.success("Compilation successful!");

            const successMatch = output.match(
              /Code\s*:\s*(\d+)\s*bytes\nData\s*:\s*(\d+)\s*bytes\nStack\/Heap\s*:\s*(\d+)\s*bytes\nEstimated usage\s*:\s*(\d+)\s*cells\nTotal requirements\s*:\s*(\d+)\s*bytes/,
            );

            if (successMatch) {
              logger.routine("Compilation statistics:");
              logger.info(
                `${path.basename(inputFile || "")} compiled successfully (${successMatch[5]} bytes)`,
              );
              logger.detail(`Code: ${successMatch[1]} bytes`);
              logger.detail(`Data: ${successMatch[2]} bytes`);
              logger.detail(`Stack/Heap: ${successMatch[3]} bytes`);
              logger.detail(`Estimated usage: ${successMatch[4]} cells`);
            }

            process.exit(0);
          } else {
            logger.error("Compilation failed!");
            process.exit(1);
          }
        });
      } catch (error) {
        logger.error(
          `An error occurred during the build process: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        process.exit(1);
      }
    });
}

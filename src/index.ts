#!/usr/bin/env node
import { Command } from "commander";
import { registerCommands } from "./commands";
import { version } from "../package.json";
import { logger } from "./utils/logger";

const program = new Command();

program
  .name("npt")
  .description(
    "Neufox PAWN Tools - Package manager and build tool for open.mp development",
  )
  .version(version)
  .option("-v, --verbose", "show detailed output for all operations")
  .hook("preAction", (thisCommand) => {
    if (thisCommand.opts().verbose) {
      logger.setVerbosity("verbose");
    } else {
      logger.setVerbosity("normal");
    }
  });

registerCommands(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

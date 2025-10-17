import chalk from 'chalk';
import { logger } from './logger';

let bannerShown = false;

/**
 * Render the tapi banner once per process invocation.
 *
 * @param showFull - When true, prints the large ASCII art banner; otherwise
 * prints a concise single-line version.
 */
export function showBanner(showFull = true): void {
  if (bannerShown) {
    return;
  }

  if (!showFull) {
    logger.plain(
      chalk.cyan('tapi') +
        chalk.gray(' - Pawn package manager and build tool')
    );
    bannerShown = true;
    return;
  }

  logger.plain(
    chalk.cyan(`

██╗      ████████╗ █████╗ ██████╗ ██╗            
╚██╗     ╚══██╔══╝██╔══██╗██╔══██╗██║            
 ╚██╗       ██║   ███████║██████╔╝██║            
 ██╔╝       ██║   ██╔══██║██╔═══╝ ██║            
██╔╝        ██║   ██║  ██║██║     ██║    ███████╗
╚═╝         ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝    ╚══════╝
`) +
      chalk.white(`
    Package manager and build tool for open.mp/SA-MP development
`) +
      chalk.gray(`
=========================================================================
  `)
  );

  bannerShown = true;
}

/**
 * Reset the tracked banner state so tests or subsequent runs can display it again.
 */
export function resetBannerState(): void {
  bannerShown = false;
}

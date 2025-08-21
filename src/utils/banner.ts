import chalk from 'chalk';
import { logger } from './logger';

let bannerShown = false;

export function showBanner(showFull = true): void {
  if (bannerShown) {
    return;
  }
  
  if (!showFull) {
    logger.plain(chalk.cyan('>_pawnctl') + chalk.gray(' - PAWN package manager and build tool'));
    bannerShown = true;
    return;
  }

  logger.plain(chalk.cyan(`

██╗         ██████╗  █████╗ ██╗    ██╗███╗   ██╗ ██████╗████████╗██╗     
╚██╗        ██╔══██╗██╔══██╗██║    ██║████╗  ██║██╔════╝╚══██╔══╝██║     
 ╚██╗       ██████╔╝███████║██║ █╗ ██║██╔██╗ ██║██║        ██║   ██║     
 ██╔╝       ██╔═══╝ ██╔══██║██║███╗██║██║╚██╗██║██║        ██║   ██║     
██╔╝███████╗██║     ██║  ██║╚███╔███╔╝██║ ╚████║╚██████╗   ██║   ███████╗
╚═╝ ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚══════╝
`) + chalk.white(`
    Package manager and build tool for open.mp/SA-MP development
`) + chalk.gray(`
=========================================================================
  `));
  
  bannerShown = true;
}

export function resetBannerState(): void {
  bannerShown = false;
}
import { logger } from './logger';

let bannerShown = false;

export function showBanner(showFull = true): void {
  if (bannerShown) {
    return;
  }
  
  if (!showFull) {
    logger.plain(`>_pawnctl - PAWN package manager and build tool`);
    bannerShown = true;
    return;
  }

  console.log(`

██╗         ██████╗  █████╗ ██╗    ██╗███╗   ██╗ ██████╗████████╗██╗     
╚██╗        ██╔══██╗██╔══██╗██║    ██║████╗  ██║██╔════╝╚══██╔══╝██║     
 ╚██╗       ██████╔╝███████║██║ █╗ ██║██╔██╗ ██║██║        ██║   ██║     
 ██╔╝       ██╔═══╝ ██╔══██║██║███╗██║██║╚██╗██║██║        ██║   ██║     
██╔╝███████╗██║     ██║  ██║╚███╔███╔╝██║ ╚████║╚██████╗   ██║   ███████╗
╚═╝ ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚══════╝

    Package manager and build tool for open.mp/SA-MP development

=========================================================================
  `);
  
  bannerShown = true;
}

export function resetBannerState(): void {
  bannerShown = false;
}
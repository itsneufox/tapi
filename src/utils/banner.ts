import { logger } from './logger';

export function showBanner(showFull = true): void {
  if (!showFull) {
    logger.plain(`>_pawnctl - PAWN package manager and build tool`);
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
}

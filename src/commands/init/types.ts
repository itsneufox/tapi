/**
 * CLI flags accepted by `tapi init`.
 */
export interface CommandOptions {
  name?: string;
  description?: string;
  author?: string;
  quiet?: boolean;
  verbose?: boolean;
  initGit?: boolean;
  logToFile?: boolean | string;
  skipCompiler?: boolean;
  legacySamp?: boolean;
}

/**
 * Answers gathered from the initial project prompts.
 */
export interface InitialAnswers {
  name: string;
  description: string;
  author: string;
  projectType: 'gamemode' | 'filterscript' | 'library';
  addStdLib: boolean;
  initGit: boolean;
  downloadServer: boolean;
  editor: 'VS Code' | 'Sublime Text' | 'Other/None';
}

/**
 * Responses collected when configuring the compiler installation.
 */
export interface CompilerAnswers {
  downloadCompiler: boolean;
  compilerVersion: string;
  keepQawno?: boolean;
  downgradeQawno?: boolean;
  installCompilerFolder?: boolean;
  useCompilerFolder?: boolean;
  downloadStdLib: boolean;
}

/**
 * Minimal process snapshot used during setup-run operations.
 */
export interface ServerState {
  pid?: number;
  serverPath?: string;
  tempFiles?: string[];
}

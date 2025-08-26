export interface CommandOptions {
  name?: string;
  description?: string;
  author?: string;
  quiet?: boolean;
  verbose?: boolean;
  initGit?: boolean;
}

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

export interface CompilerAnswers {
  downloadCompiler: boolean;
  compilerVersion: string;
  keepQawno?: boolean;
  downgradeQawno?: boolean;
  installCompilerFolder?: boolean;
  useCompilerFolder?: boolean;
  downloadStdLib: boolean;
}

export interface ServerState {
  pid?: number;
  serverPath?: string;
  tempFiles?: string[];
}

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { InitialAnswers, CompilerAnswers } from '../commands/init/types';

interface PresetOptions {
  legacySamp?: boolean;
  skipCompiler?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  nonInteractive?: boolean;
}

export interface LoadedInitPreset {
  project?: Partial<InitialAnswers>;
  compiler?: Partial<CompilerAnswers>;
  options?: PresetOptions;
  acceptPreset?: boolean;
  source: string;
}

type RawPreset = {
  project?: unknown;
  compiler?: unknown;
  options?: unknown;
  acceptPreset?: unknown;
};

type RawPresetObject = Record<string, unknown>;

export function loadInitPreset(requested?: string): LoadedInitPreset | null {
  const candidatePaths = resolvePresetCandidates(requested);

  for (const presetPath of candidatePaths) {
    if (!presetPath) continue;
    if (!fs.existsSync(presetPath) || !fs.statSync(presetPath).isFile()) {
      continue;
    }

    const rawContent = fs.readFileSync(presetPath, 'utf8');
    if (!rawContent.trim()) {
      throw new Error(`Preset file "${presetPath}" is empty`);
    }

    const parsed = parsePreset(rawContent, presetPath);
    const context = buildPlaceholderContext(parsed);
    const resolved = resolvePlaceholders(parsed, context);

    const project = normalizeProject(resolved.project);
    const compiler = normalizeCompiler(resolved.compiler);
    const options = normalizeOptions(resolved.options);

    const acceptPreset =
      typeof resolved.acceptPreset === 'boolean'
        ? resolved.acceptPreset
        : options?.nonInteractive;

    if (options && Object.prototype.hasOwnProperty.call(options, 'nonInteractive')) {
      delete options.nonInteractive;
    }

    return {
      project: Object.keys(project).length ? project : undefined,
      compiler: Object.keys(compiler).length ? compiler : undefined,
      options: options && Object.keys(options).length ? options : undefined,
      acceptPreset,
      source: presetPath,
    };
  }

  return null;
}

function resolvePresetCandidates(requested?: string): string[] {
  const candidates: string[] = [];
  const command = 'init';

  const projectWorkflows = path.join(process.cwd(), '.tapi', 'workflows');
  const userWorkflows = path.join(os.homedir(), '.tapi', 'workflows');

  const addCommandFiles = (baseDir: string, name?: string) => {
    const suffix = name ? `-${name}` : '';
    candidates.push(
      path.join(baseDir, `${command}${suffix}.yml`),
      path.join(baseDir, `${command}${suffix}.yaml`),
      path.join(baseDir, `${command}${suffix}.json`)
    );
    if (name) {
      candidates.push(
        path.join(baseDir, command, `${name}.yml`),
        path.join(baseDir, command, `${name}.yaml`),
        path.join(baseDir, command, `${name}.json`)
      );
    } else {
      candidates.push(
        path.join(baseDir, command, 'default.yml'),
        path.join(baseDir, command, 'default.yaml'),
        path.join(baseDir, command, 'default.json')
      );
    }
  };

  if (requested) {
    const absolute = path.isAbsolute(requested)
      ? requested
      : path.resolve(process.cwd(), requested);

    candidates.push(absolute);
    addCommandFiles(projectWorkflows, requested);
    addCommandFiles(userWorkflows, requested);
    return candidates;
  }

  addCommandFiles(projectWorkflows);
  addCommandFiles(userWorkflows);

  return candidates;
}

function parsePreset(contents: string, filePath: string): RawPreset {
  const trimmed = contents.trim();
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as RawPreset;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON preset "${filePath}": ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }

  try {
    return parseSimpleYaml(contents);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML preset "${filePath}": ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

function parseSimpleYaml(text: string): RawPreset {
  const sanitized = text.replace(/\t/g, '  ');
  const lines = sanitized.split(/\r?\n/);
  const [result] = parseYamlBlock(lines, 0, 0);
  return result as RawPreset;
}

function parseYamlBlock(
  lines: string[],
  startIndex: number,
  indent: number
): [RawPresetObject, number] {
  const result: RawPresetObject = {};
  let index = startIndex;

  while (index < lines.length) {
    let line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      index += 1;
      continue;
    }

    const currentIndent = line.match(/^ */)?.[0].length ?? 0;
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent > indent) {
      throw new Error(`Invalid indentation at line ${index + 1}`);
    }

    line = line.slice(indent);
    if (line.startsWith('-')) {
      throw new Error('Arrays are not supported in init presets');
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`Invalid preset entry at line ${index + 1}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    let remainder = line.slice(separatorIndex + 1);
    const commentIndex = remainder.indexOf('#');
    if (commentIndex !== -1) {
      const before = remainder.slice(0, commentIndex);
      if (!before || /\s$/.test(before)) {
        remainder = before;
      }
    }

    const valueText = remainder.trim();
    if (!valueText) {
      const [child, nextIndex] = parseYamlBlock(lines, index + 1, indent + 2);
      result[key] = child;
      index = nextIndex;
    } else {
      result[key] = parseScalar(valueText);
      index += 1;
    }
  }

  return [result, index];
}

function parseScalar(value: string): unknown {
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('\'') && value.endsWith('\''))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function buildPlaceholderContext(raw: RawPreset): Record<string, string> {
  const now = new Date();
  const cwd = process.cwd();
  const folderName = path.basename(cwd);
  const project = (raw.project ?? {}) as RawPresetObject;

  return {
    folder: folderName,
    slug: createSlug(folderName),
    cwd,
    user: safeUserName(),
    hostname: os.hostname(),
    date: now.toISOString(),
    timestamp: String(now.getTime()),
    year: String(now.getFullYear()),
    gitBranch: detectGitBranch(),
    projectType:
      typeof project.projectType === 'string' ? (project.projectType as string) : '',
    name: typeof project.name === 'string' ? (project.name as string) : '',
    editor: typeof project.editor === 'string' ? (project.editor as string) : '',
  };
}

function createSlug(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  return base || 'project';
}

function detectGitBranch(): string {
  try {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });

    if (result.status === 0) {
      const branch = (result.stdout || '').trim();
      return branch === 'HEAD' ? '' : branch;
    }
  } catch {
    // Ignore git errors
  }

  return '';
}

function safeUserName(): string {
  try {
    const info = os.userInfo();
    if (info && info.username) {
      return info.username;
    }
  } catch {
    // Ignore lookup errors
  }

  return process.env.USER || process.env.USERNAME || '';
}

function resolvePlaceholders<T>(value: T, context: Record<string, string>): T {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, token: string) => {
      if (token.startsWith('env:')) {
        return process.env[token.slice(4)] ?? '';
      }
      return context[token] ?? '';
    }) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolvePlaceholders(item, context)) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as RawPresetObject)) {
      result[key] = resolvePlaceholders(inner, context);
    }
    return result as unknown as T;
  }

  return value;
}

function normalizeProject(raw: unknown): Partial<InitialAnswers> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const candidate = raw as RawPresetObject;
  const result: Partial<InitialAnswers> = {};

  if (typeof candidate.name === 'string') {
    result.name = candidate.name as string;
  }
  if (typeof candidate.description === 'string') {
    result.description = candidate.description as string;
  }
  if (typeof candidate.author === 'string') {
    result.author = candidate.author as string;
  }

  if (
    typeof candidate.projectType === 'string' &&
    ['gamemode', 'filterscript', 'library'].includes(candidate.projectType as string)
  ) {
    result.projectType = candidate.projectType as InitialAnswers['projectType'];
  }

  if (
    typeof candidate.editor === 'string' &&
    ['VS Code', 'Sublime Text', 'Other/None'].includes(candidate.editor as string)
  ) {
    result.editor = candidate.editor as InitialAnswers['editor'];
  }

  if (typeof candidate.initGit === 'boolean') {
    result.initGit = candidate.initGit as boolean;
  }

  if (typeof candidate.downloadServer === 'boolean') {
    result.downloadServer = candidate.downloadServer as boolean;
  }

  if (typeof candidate.addStdLib === 'boolean') {
    result.addStdLib = candidate.addStdLib as boolean;
  }

  return result;
}

function normalizeCompiler(raw: unknown): Partial<CompilerAnswers> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const candidate = raw as RawPresetObject;
  const result: Partial<CompilerAnswers> = {};

  if (typeof candidate.downloadCompiler === 'boolean') {
    result.downloadCompiler = candidate.downloadCompiler as boolean;
  }
  if (typeof candidate.compilerVersion === 'string') {
    result.compilerVersion = candidate.compilerVersion as string;
  }
  if (typeof candidate.keepQawno === 'boolean') {
    result.keepQawno = candidate.keepQawno as boolean;
  }
  if (typeof candidate.downgradeQawno === 'boolean') {
    result.downgradeQawno = candidate.downgradeQawno as boolean;
  }
  if (typeof candidate.installCompilerFolder === 'boolean') {
    result.installCompilerFolder = candidate.installCompilerFolder as boolean;
  }
  if (typeof candidate.useCompilerFolder === 'boolean') {
    result.useCompilerFolder = candidate.useCompilerFolder as boolean;
  }
  if (typeof candidate.downloadStdLib === 'boolean') {
    result.downloadStdLib = candidate.downloadStdLib as boolean;
  }
  if (typeof candidate.compilerDownloadUrl === 'string') {
    result.compilerDownloadUrl = candidate.compilerDownloadUrl as string;
  }
  if (typeof candidate.stdLibDownloadUrl === 'string') {
    result.stdLibDownloadUrl = candidate.stdLibDownloadUrl as string;
  }

  return result;
}

function normalizeOptions(raw: unknown): PresetOptions | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const candidate = raw as RawPresetObject;
  const result: PresetOptions = {};

  if (typeof candidate.legacySamp === 'boolean') {
    result.legacySamp = candidate.legacySamp as boolean;
  }
  if (typeof candidate.skipCompiler === 'boolean') {
    result.skipCompiler = candidate.skipCompiler as boolean;
  }
  if (typeof candidate.quiet === 'boolean') {
    result.quiet = candidate.quiet as boolean;
  }
  if (typeof candidate.verbose === 'boolean') {
    result.verbose = candidate.verbose as boolean;
  }
  if (typeof candidate.nonInteractive === 'boolean') {
    result.nonInteractive = candidate.nonInteractive as boolean;
  }

  return result;
}

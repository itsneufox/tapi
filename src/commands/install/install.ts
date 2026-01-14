import { Argument, Command } from 'commander';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { logger } from '../../utils/logger';
import {
  fetchRepoDefaultBranch,
  fetchRepoPawnInfo,
  GithubRepoInfo,
  Release,
} from '../../utils/githubHandler';
import { hasAtLeastOne, hasTwoOrMore } from '../../utils/general';
import { showBanner } from '../../utils/banner';
import { extractArchive } from '../../utils/archive';
import { downloadWithRetry, fetchWithRetry } from '../../utils/retry';
import { getFromCache, saveToCache } from '../../utils/cache';

import { Readable } from 'node:stream';

/**
 * Git repository reference where installation should occur via raw git URL.
 */
interface GitInfo {
  git: string;
}

enum RepoType {
  gitLink,
  github,
}

/**
 * Find a file or directory in an extracted archive directory.
 * Handles various archive structures (flat, nested, with/without root folder).
 */
function findFileInDir(baseDir: string, searchPath: string): string | null {
  const normalizedSearch = searchPath.replace(/\\/g, '/');
  const searchName = path.basename(normalizedSearch);

  // Try direct path first
  const directPath = path.join(baseDir, normalizedSearch);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // Try just the filename/dirname in base
  const flatPath = path.join(baseDir, searchName);
  if (fs.existsSync(flatPath)) {
    return flatPath;
  }

  // Recursively search for the file
  function searchRecursive(dir: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.name === searchName) {
        return fullPath;
      }

      if (entry.isDirectory()) {
        // Check if this path matches the search pattern
        const relativePath = path
          .relative(baseDir, fullPath)
          .replace(/\\/g, '/');
        if (
          normalizedSearch.endsWith(relativePath) ||
          relativePath.endsWith(normalizedSearch)
        ) {
          return fullPath;
        }

        const found = searchRecursive(fullPath);
        if (found) return found;
      }
    }

    return null;
  }

  return searchRecursive(baseDir);
}

/**
 * Copy all .inc files from a source directory to the destination include directory.
 */
function copyIncludeFiles(sourceDir: string, destDir: string): void {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      fs.mkdirSync(destPath, { recursive: true });
      copyIncludeFiles(sourcePath, destPath);
    } else if (entry.name.endsWith('.inc') || entry.name.endsWith('.pwn')) {
      // Copy include files
      fs.copyFileSync(sourcePath, destPath);
      logger.success(`Installed include: ${entry.name}`);
    }
  }
}

function getRepoType(repo: GitInfo | GithubRepoInfo): RepoType {
  if ('git' in repo) {
    return RepoType.gitLink;
  } else if ('owner' in repo && 'repository' in repo) {
    return RepoType.github;
  }
  throw new Error('Unknown repository type');
}

/**
 * Download repository source tarball from GitHub.
 * Uses the zipball endpoint which doesn't require authentication for public repos.
 */
async function downloadRepoSource(
  repo: GithubRepoInfo,
  destPath: string
): Promise<void> {
  const ref = repo.tag || repo.branch || repo.commitId || 'HEAD';
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/zipball/${ref}`;

  logger.routine(`Downloading source from ${url}`);

  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'tapi - https://github.com/itsneufox/tapi/issues',
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download source: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error('Failed to download source: response body is null');
  }

  const fileStream = fs.createWriteStream(destPath);
  // @ts-expect-error WebStream / Node stream typing mismatch (runtime is valid)
  Readable.fromWeb(response.body).pipe(fileStream);

  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve as () => void);
    fileStream.on('error', reject);
  });

  logger.routine(`Downloaded source to ${destPath}`);
}

/**
 * Install includes from repository source code.
 * Downloads the repo, extracts it, finds .inc files based on include_path, and copies to qawno/include.
 */
async function installIncludesFromSource(
  repo: GithubRepoInfo,
  pawnInfo: { include_path?: string },
  tempDir: string
): Promise<void> {
  const includePath = pawnInfo.include_path || '';

  logger.working('Installing includes from repository source');
  if (includePath) {
    logger.detail(`Using include_path: ${includePath}`);
  }

  // Download source zipball
  const zipPath = path.join(tempDir, 'source.zip');
  await downloadRepoSource(repo, zipPath);

  // Extract to temp directory
  const extractDir = path.join(tempDir, 'source');
  fs.mkdirSync(extractDir, { recursive: true });
  await extractArchive(zipPath, extractDir);

  // GitHub zipballs extract to a folder like "owner-repo-commitsha/"
  // Find that root folder
  const extractedContents = fs.readdirSync(extractDir);
  let sourceRoot = extractDir;
  if (extractedContents.length === 1) {
    const possibleRoot = path.join(extractDir, extractedContents[0]);
    if (fs.statSync(possibleRoot).isDirectory()) {
      sourceRoot = possibleRoot;
    }
  }

  // Determine the include source directory
  const includeSourceDir = includePath
    ? path.join(sourceRoot, includePath)
    : sourceRoot;

  if (!fs.existsSync(includeSourceDir)) {
    logger.warn(`Include path not found: ${includePath || '(root)'}`);
    return;
  }

  // Prepare destination
  const includesDestDir = path.join(process.cwd(), 'qawno', 'include');
  fs.mkdirSync(includesDestDir, { recursive: true });

  // Copy all .inc files (and preserve subdirectory structure)
  let installedCount = 0;

  function copyIncludesRecursive(
    srcDir: string,
    destDir: string,
    relativePath: string = ''
  ): void {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      const relPath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        fs.mkdirSync(destPath, { recursive: true });
        copyIncludesRecursive(srcPath, destPath, relPath);
      } else if (entry.name.endsWith('.inc')) {
        // Copy include file
        fs.copyFileSync(srcPath, destPath);
        logger.success(`Installed include: ${relPath}`);
        installedCount++;
      }
    }
  }

  copyIncludesRecursive(includeSourceDir, includesDestDir);

  if (installedCount === 0) {
    logger.warn('No .inc files found in the repository');
  } else {
    logger.success(`Installed ${installedCount} include file(s)`);
  }
}

/**
 * Type guard that checks whether a repository description targets GitHub.
 */
function isRepoGithub(repo: GitInfo | GithubRepoInfo): repo is GithubRepoInfo {
  return getRepoType(repo) === RepoType.github;
}

const repoMatcher = new RegExp(
  '^([a-zA-Z0-9-_.]+)/([a-zA-Z0-9-_.]+)(?:@([a-zA-Z0-9-_./+]+))?$'
);
const tagMatcher = /^v[0-9]+\.[0-9]+\.[0-9][0-9a-zA-Z]*$/;

async function onInstallCommand(
  repo: Promise<GitInfo | GithubRepoInfo> | (GitInfo | GithubRepoInfo),
  _options: {
    dependencies: boolean;
    cleanup?: boolean;
    'ignore-missing'?: boolean;
  }
): Promise<void> {
  repo = await repo;

  if (isRepoGithub(repo)) {
    logger.info(
      `Installing from GitHub repository: https://github.com/${repo.owner}/${repo.repository}`
    );

    if (!hasAtLeastOne(repo, ['branch', 'commitId', 'tag'])) {
      //TODO: Auto default branch
      logger.error('You need to specify a repo branch, commitId or tag');
      return;
    }
    if (hasTwoOrMore(repo, ['branch', 'commitId', 'tag'])) {
      logger.error(
        'You can only specify one of the three: branch, commitId or tag (how did u even do this)'
      );
      return;
    }

    //TODO: Cache
    logger.working('Fetching repository information');
    logger.detail('Checking for pawn.json in repository...');

    const tempFolder = os.tmpdir();
    if (!tempFolder || !fs.existsSync(tempFolder)) {
      logger.error(`Failed to get temporary folder path. Got: ${tempFolder}`);
      process.exit(0);
    }

    const currentUuid = randomUUID();
    const downloadPath = path.join(tempFolder, `tapi-${currentUuid}`);
    logger.routine(`Using temporary folder at ${downloadPath}`);

    fs.mkdirSync(downloadPath);

    let expectedPlatform: string;
    switch (os.platform()) {
      case 'win32':
        expectedPlatform = 'windows';
        break;
      case 'linux':
        expectedPlatform = 'linux';
        break;
      case 'darwin':
        expectedPlatform = 'macos';
        break;
      default:
        expectedPlatform = 'unknown';
        break;
    }

    if (expectedPlatform === 'unknown') {
      logger.error(`Unsupported platform: ${process.platform}`);
      process.exit(0);
    }

    try {
      const data = (await fetchRepoPawnInfo(repo)) as {
        user?: string;
        repo?: string;
        dependencies?: string[];
        include_path?: string;
        resources?: Array<{
          name: string;
          platform: string;
          archive?: boolean;
          includes?: string[];
          plugins?: string[];
        }>;
      };
      logger.success('Repository information fetched successfully');

      if (data.resources) {
        if (data.resources?.length && !repo['tag']) {
          logger.error(
            'This repository uses resources, which require a tag with a associated release to download. (No tag was specified)'
          );
          process.exit(0);
        }

        const neededResources = data.resources.filter(
          (v) => v.platform.toLowerCase() === expectedPlatform
        );
        if (neededResources.length === 0) {
          logger.error(`No resources found for platform ${expectedPlatform}`);
          process.exit(0);
        }

        logger.routine(
          `Found ${neededResources.length} resource(s) for platform ${expectedPlatform}: ${neededResources.map((v) => v.name).join(', ')}`
        );

        const resourcesTempFolder = path.join(downloadPath, 'resources');
        try {
          fs.mkdirSync(resourcesTempFolder);
        } catch (e) {
          logger.error(
            `Failed to create temporary folder for resources at ${resourcesTempFolder}`
          );
          logger.detail(`Error: ${(e as Error).message}`);
          process.exit(0);
        }

        async function fetchRepoReleaseData(repoInfo: GithubRepoInfo) {
          let result: Response;
          try {
            result = await fetch(
              `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repository}/releases/tags/${repoInfo.tag}`
            );
          } catch (e) {
            logger.error(
              `Network error while fetching release data for tag ${repoInfo.tag}`
            );
            logger.detail(`Error: ${(e as Error).message}`);
            process.exit(0);
          }

          if (result.status !== 200) {
            logger.error(
              `Failed to fetch release data for tag ${repoInfo.tag}. Status: ${result.status}`
            );
            process.exit(0);
          }

          return (await result.json()) as Release;
        }
        const releasesData: Release = await fetchRepoReleaseData(repo);

        if (!releasesData.assets || releasesData.assets.length === 0) {
          logger.error(`No assets found in release for tag ${repo.tag}`);
          process.exit(0);
        }

        for (const resource of neededResources) {
          logger.routine(`Processing resource ${resource.name}...`);

          const matchedAsset = releasesData.assets.find(
            (v) => v.name === resource.name
          );

          if (!matchedAsset) {
            if (_options['ignore-missing'] != true) {
              logger.error(
                `Resource asset ${resource.name} not found in release assets`
              );
              process.exit(0);
            } else {
              logger.warn(
                `Resource asset ${resource.name} not found in release assets`
              );
              continue;
            }
          }

          const assetDownloadPath = path.join(
            resourcesTempFolder,
            matchedAsset.name
          );

          try {
            // Check cache first (only for tagged releases)
            const cachedPath = repo.tag
              ? getFromCache(
                  repo.owner,
                  repo.repository,
                  repo.tag,
                  matchedAsset.name
                )
              : null;

            if (cachedPath) {
              logger.routine(`Using cached asset: ${matchedAsset.name}`);
              fs.copyFileSync(cachedPath, assetDownloadPath);
            } else {
              logger.routine(`Downloading asset ${matchedAsset.name}...`);

              // Download with automatic retries
              const response = await downloadWithRetry(
                matchedAsset.browser_download_url
              );

              if (!response.ok) {
                throw new Error(
                  `Failed to download asset: ${response.status} ${response.statusText}`
                );
              }

              if (!response.body) {
                throw new Error(
                  'Failed to download asset: response body is null'
                );
              }

              const fileStream = fs.createWriteStream(assetDownloadPath);

              // @ts-expect-error WebStream / Node stream typing mismatch (runtime is valid)
              Readable.fromWeb(response.body).pipe(fileStream);

              // await end of download
              await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve as () => void);
                fileStream.on('error', reject);
              });

              logger.routine(`Downloaded asset to ${assetDownloadPath}`);

              // Save to cache for future use (only for tagged releases)
              if (repo.tag) {
                saveToCache(
                  repo.owner,
                  repo.repository,
                  repo.tag,
                  matchedAsset.name,
                  assetDownloadPath
                );
              }
            }

            // Check if this is an archive that needs extraction
            if (resource.archive) {
              logger.routine(`Resource is an archive, extracting...`);

              const extractDir = path.join(
                resourcesTempFolder,
                `extract-${randomUUID()}`
              );
              fs.mkdirSync(extractDir, { recursive: true });

              // Extract the full archive first
              await extractArchive(assetDownloadPath, extractDir);
              logger.routine(`Archive extracted to ${extractDir}`);

              // Process plugins from the archive
              if (resource.plugins && resource.plugins.length > 0) {
                const pluginsDir = path.join(process.cwd(), 'plugins');
                fs.mkdirSync(pluginsDir, { recursive: true });

                for (const pluginPath of resource.plugins) {
                  const pluginName = path.basename(pluginPath);
                  const sourcePath = findFileInDir(extractDir, pluginPath);

                  if (sourcePath) {
                    const destPath = path.join(pluginsDir, pluginName);
                    fs.copyFileSync(sourcePath, destPath);
                    logger.success(`Installed plugin: ${pluginName}`);
                  } else {
                    logger.warn(`Plugin not found in archive: ${pluginPath}`);
                  }
                }
              }

              // Process includes from the archive
              if (resource.includes && resource.includes.length > 0) {
                const includesDir = path.join(
                  process.cwd(),
                  'qawno',
                  'include'
                );
                fs.mkdirSync(includesDir, { recursive: true });

                for (const includePath of resource.includes) {
                  const sourcePath = findFileInDir(extractDir, includePath);

                  if (sourcePath) {
                    const stat = fs.statSync(sourcePath);
                    if (stat.isDirectory()) {
                      // Copy all .inc files from directory
                      copyIncludeFiles(sourcePath, includesDir);
                    } else {
                      // Copy single file
                      const destPath = path.join(
                        includesDir,
                        path.basename(includePath)
                      );
                      fs.copyFileSync(sourcePath, destPath);
                      logger.success(
                        `Installed include: ${path.basename(includePath)}`
                      );
                    }
                  } else {
                    logger.warn(`Include not found in archive: ${includePath}`);
                  }
                }
              }

              // Cleanup extract directory
              fs.rmSync(extractDir, { recursive: true, force: true });
            } else {
              // Not an archive - direct file copy (original behavior)
              const pluginsDir = path.join(process.cwd(), 'plugins');
              fs.mkdirSync(pluginsDir, { recursive: true });
              fs.copyFileSync(
                assetDownloadPath,
                path.join(pluginsDir, matchedAsset.name)
              );
              logger.success(`Installed plugin: ${matchedAsset.name}`);
            }
          } catch (e) {
            if (_options['ignore-missing'] == true) {
              logger.warn(`Failed to process asset ${matchedAsset.name}`);
              logger.detail(`Error: ${(e as Error).message}`);
              continue;
            } else {
              logger.error(`Failed to process asset ${matchedAsset.name}`);
              logger.detail(`Error: ${(e as Error).message}`);
              process.exit(0);
            }
          }
        }

        // Check if any resources had includes - if not, install from source
        const hasResourceIncludes = neededResources.some(
          (r) => r.includes && r.includes.length > 0
        );
        if (!hasResourceIncludes) {
          // Resources exist but don't have includes, install from source
          logger.routine(
            'Resources do not contain includes, installing from source'
          );
          await installIncludesFromSource(
            repo,
            { include_path: data.include_path },
            downloadPath
          );
        }
      } else {
        // No resources - this is a pure include library, install from source
        await installIncludesFromSource(
          repo,
          { include_path: data.include_path },
          downloadPath
        );
      }

      //TODO: Handle dependencies
    } catch (error: unknown) {
      logger.error('Failed to fetch repository');

      const errorObj = error as {
        code?: number;
        message?: string;
        error?: { message?: string };
      };
      if (errorObj.code === -3) {
        logger.error('Repository is not a pawn module (no pawn.json found)');
        logger.detail(
          'Make sure the repository contains a pawn.json file in the root directory'
        );
      } else if (errorObj.code === 404) {
        logger.error('Repository not found or pawn.json file missing');
        logger.detail(
          `Checked URL: https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json`
        );
      } else if (errorObj.code === -2) {
        logger.error('Network error while fetching repository info');
        logger.detail(
          `Original error: ${errorObj.error?.message || 'Unknown network error'}`
        );
      } else {
        logger.error(`Error ${errorObj.code}: ${errorObj.message}`);
        if (errorObj.error) {
          logger.detail(`Details: ${JSON.stringify(errorObj.error, null, 2)}`);
        }
      }
      return;
    }
  } else {
    logger.error('Git URL installation not implemented yet');
    logger.detail('Currently only GitHub repositories are supported');
    throw new Error('Not implemented');
  }
}

/**
 * Parse user-provided repository spec into GitHub or generic git data.
 */
async function parseRepoInfo(value: string) {
  let requestedRepo: GitInfo | GithubRepoInfo;
  const match = repoMatcher.exec(value);
  if (match !== null) {
    logger.routine(
      `Detected repo as a github repository: https://github.com/${match[1]}/${match[2]}/`
    );
    if (match[3] != undefined) {
      if (tagMatcher.test(match[3])) {
        logger.routine(`Detected repo with tag ${match[3]}`);
        requestedRepo = {
          owner: match[1],
          repository: match[2],
          tag: match[3],
        } as GithubRepoInfo;
      } else {
        logger.routine(`Detected repo with branch ${match[3]}`);
        requestedRepo = {
          owner: match[1],
          repository: match[2],
          branch: match[3],
        } as GithubRepoInfo;
      }
      // TODO: Handle commits (maybe check with API if its valid branch before using as such?)
    } else {
      logger.routine(
        `Coudn't detect a branch/tag/commit on repo. Using default branch`
      );

      let repoName: string;
      try {
        repoName = await fetchRepoDefaultBranch({
          owner: match[1],
          repository: match[2],
        } as GithubRepoInfo);
      } catch (e) {
        const error = e as { message: string; detailed?: Error };
        logger.error(`Failed to fetch default branch: ${error.message}`);
        logger.error(
          `Detailed error: ${error.detailed?.message || 'Unknown error'}`
        );
        process.exit(1);
      }
      logger.detail(`Default branch detected as ${repoName}`);

      requestedRepo = {
        owner: match[1],
        repository: match[2],
        branch: repoName,
      } as GithubRepoInfo;
    }
  } else {
    //Maybe better git link detection?
    logger.routine(`Detected repo as a git link.`);
    requestedRepo = { git: value } as GitInfo;
  }
  return requestedRepo;
}

//TODO: temp folder overridable in config maybe
/**
 * Register the `install` command that installs includes/plugins from GitHub repositories.
 *
 * @param program - Commander instance to augment.
 */
export default function (program: Command): void {
  program
    .command('install')
    .description('Installs a include or plugin into the project')
    .addArgument(
      new Argument('<repo>', 'github repository to install')
        .argParser(parseRepoInfo)
        .argRequired()
    )
    .option('--no-dependencies', 'do not install dependencies')
    .option('--no-cleanup', 'do not remove temporary files after installation')
    .option('--ignore-missing', 'ignore missing resources in releases', false)
    .action(async (repo, options) => {
      showBanner(false);

      try {
        await onInstallCommand(repo, {
          dependencies: options.dependencies,
          cleanup: options.cleanup,
          'ignore-missing': options['ignore-missing'],
        });
      } catch (error) {
        logger.error(
          `Install failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

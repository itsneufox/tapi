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

import { exec } from "child_process";
import { pipeline, Readable } from 'node:stream';

function commandExists(cmd: string) {
  const platform = process.platform;
  const check = platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
  return new Promise((resolve) => {
    exec(check, (err: any, stdout: any, stderr: any) => {
      if (err) {
        resolve(false);
      } else {
        // optionally: check stdout content
        resolve(!!stdout.trim());
      }
    });
  });
}

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

function createCacheForResource(name: string, resources: Array<{ name: string, platform: string, archive?: boolean, includes?: string[], plugins?: string[] }>): string | null {
  const cacheDir = path.join(os.homedir(), '.pawnctl', 'cache');

  // fs.cpSync(resources)
  return null;
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
    switch(os.platform()) {
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
      const data = await fetchRepoPawnInfo(repo) as {
        user?: string;
        repo?: string;
        dependencies?: string[];
        include_path?: string;
        resources?: Array<{ 
          name: string,
          platform: string,
          archive?: boolean,
          includes?: string[],
          plugins?: string[]
        }>;
      };
      logger.success('Repository information fetched successfully');

      if (data.resources)
      {
        if (data.resources?.length && !repo['tag']) {
          logger.error('This repository uses resources, which require a tag with a associated release to download. (No tag was specified)');
          process.exit(0);
        }
  
        const neededResources = data.resources.filter(v => v.platform.toLowerCase() === expectedPlatform);
        if (neededResources.length === 0) {
          logger.error(`No resources found for platform ${expectedPlatform}`);
          process.exit(0);
        }
  
        logger.routine(`Found ${neededResources.length} resource(s) for platform ${expectedPlatform}: ${neededResources.map(v => v.name).join(', ')}`);
  
        const resourcesTempFolder = path.join(downloadPath, 'resources');
        try {
          fs.mkdirSync(resourcesTempFolder);
        }
        catch(e) {
          logger.error(`Failed to create temporary folder for resources at ${resourcesTempFolder}`);
          logger.detail(`Error: ${(e as Error).message}`);
          process.exit(0);
        }

        async function fetchRepoReleaseData(repoInfo: GithubRepoInfo) {
          let result: Response;
          try {
            result = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repository}/releases/tags/${repoInfo.tag}`);
          }
          catch(e) {
            logger.error(`Network error while fetching release data for tag ${repoInfo.tag}`);
            logger.detail(`Error: ${(e as Error).message}`);
            process.exit(0);
          }

          if (result.status !== 200) {
            logger.error(`Failed to fetch release data for tag ${repoInfo.tag}. Status: ${result.status}`);
            process.exit(0);
          }

          return await result.json() as Release;
        }
        const releasesData: Release = await fetchRepoReleaseData(repo);

        if (!releasesData.assets || releasesData.assets.length === 0) {
          logger.error(`No assets found in release for tag ${repo.tag}`);
          process.exit(0);
        }

        for (const resource of neededResources) {
          logger.routine(`Processing resource ${resource.name}...`);
          
          const matchedAsset = releasesData.assets.find(v => v.name === resource.name);
          
          if (!matchedAsset) {
            if (_options['ignore-missing'] != true) {
              logger.error(`Resource asset ${resource.name} not found in release assets`);
              process.exit(0);
            }
            else {
              logger.warn(`Resource asset ${resource.name} not found in release assets`);
              continue;
            }
          }

          logger.routine(`Downloading asset ${matchedAsset.name}...`);
          const assetDownloadPath = path.join(resourcesTempFolder, matchedAsset.name);
          try {
            const response = await fetch(matchedAsset.browser_download_url);
            const fileStream = fs.createWriteStream(assetDownloadPath);

            if (response.status !== 200) {
              throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
              throw new Error('Failed to download asset: response body is null');
            }
            
            // @ts-expect-error WebStream / Node stream typing mismatch (runtime is valid)
            Readable.fromWeb(response.body).pipe(fileStream);

            // await end of download
            await new Promise((resolve, reject) => {
              fileStream.on('finish', resolve as () => void);
              fileStream.on('error', reject);
            });

            logger.routine(`Downloaded asset to ${assetDownloadPath}`);

            fs.copyFileSync(assetDownloadPath, path.join(process.cwd(), 'plugins', matchedAsset.name));

            // TODO: add to legacy_plugins in config (or just move to components if its a component)
            logger.routine(`Copied asset to project plugins folder`);
          }
          catch(e) {
            if (_options['ignore-missing'] == true) {
              logger.warn(`Failed to download asset ${matchedAsset.name}`);
              logger.detail(`Error: ${(e as Error).message}`);
              continue;
            }
            else {
              logger.error(`Failed to download asset ${matchedAsset.name}`);
              logger.detail(`Error: ${(e as Error).message}`);
              process.exit(0);
            }
          }
        }
        
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
      logger.routine(`Coudn't detect a branch/tag/commit on repo. Using default branch`);

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
          'ignore-missing': options['ignore-missing']
        });
      } catch (error) {
        logger.error(
          `Install failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

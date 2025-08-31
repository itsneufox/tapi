import { Argument, Command } from 'commander';
import { logger } from '../../utils/logger';
import {
  fetchRepoDefaultBranch,
  fetchRepoPawnInfo,
  GithubRepoInfo,
} from '../../utils/githubHandler';
import { hasAtLeastOne, hasTwoOrMore } from '../../utils/general';
import { showBanner } from '../../utils/banner';

interface GitInfo {
  git: string;
}

enum RepoType {
  gitLink,
  github,
}

function getRepoType(repo: GitInfo | GithubRepoInfo): RepoType {
  if ('git' in repo) {
    return RepoType.gitLink;
  } else if ('owner' in repo && 'repository' in repo) {
    return RepoType.github;
  }
  throw new Error('Unknown repository type');
}

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

    // Show reference details in verbose mode
    if (repo.branch) {
      logger.routine(`Using branch: ${repo.branch}`);
    } else if (repo.tag) {
      logger.routine(`Using tag: ${repo.tag}`);
    } else if (repo.commitId) {
      logger.routine(`Using commit: ${repo.commitId}`);
    }

    logger.working('Fetching repository information');
    logger.detail('Checking for pawn.json in repository...');

    try {
      const data = await fetchRepoPawnInfo(repo);
      logger.success('Repository information fetched successfully');

      // Show the pawn.json data
      if (logger.getVerbosity() === 'verbose') {
        logger.detail('Repository pawn.json contents:');
        console.log(JSON.stringify(data, null, 2));
      }

      // Show package details in verbose mode
      const dataAny = data as {
        user?: string;
        repo?: string;
        dependencies?: string[];
        include_path?: string;
        resources?: Array<{ platform: string }>;
      };
      if (dataAny.user && dataAny.repo) {
        logger.routine(`Package: ${dataAny.user}/${dataAny.repo}`);
      }
      if (dataAny.dependencies && dataAny.dependencies.length > 0) {
        logger.routine(`Dependencies: ${dataAny.dependencies.join(', ')}`);
      }
      if (dataAny.include_path) {
        logger.routine(`Include path: ${dataAny.include_path}`);
      }

      let os: 'windows' | 'linux' | 'mac' | 'unknown';
      if (process.platform == 'win32') os = 'windows';
      else if (process.platform == 'linux') os = 'linux';
      else if (process.platform == 'darwin') os = 'mac';
      else os = 'unknown';

      if (os == 'unknown') {
        logger.error('Unsupported operating system');
        process.exit(1);
      }

      const resourceData =
        dataAny.resources?.filter(
          (v: { platform: string }) => v.platform == os
        ) || [];

      if (resourceData.length == 0) {
        logger.error(`No resources found for the current platform (${os})`);
        process.exit(1);
      }
      logger.info(JSON.stringify(resourceData, null, 2));

      //TODO: Handle dependencies
    } catch (error: unknown) {
      logger.error('Failed to fetch repository information');

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
      logger.warn(`Coudn't detect a branch/tag/commit on repo.`);
      logger.routine('Using default branch');

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
        process.exit();
      }
      logger.warn(`Default branch detected as ${repoName}`);

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
    .action(async (repo, options) => {
      showBanner(false);

      try {
        await onInstallCommand(repo, {
          dependencies: options.dependencies,
        });
      } catch (error) {
        logger.error(
          `Install failed: ${error instanceof Error ? error.message : 'unknown error'}`
        );
        process.exit(1);
      }
    });
}

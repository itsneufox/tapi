import { Argument, Command, Option } from 'commander';
import { logger } from '../../utils/logger';
import { fetchRepoDefaultBranch, fetchRepoPawnInfo, GithubRepoInfo } from '../../utils/githubHandler';
import { hasAtLeastOne, hasTwoOrMore } from '../../utils/general';

interface GitInfo {
  git: string
};

enum RepoType {
  gitLink,
  github
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

const repoMatcher = new RegExp("^([a-zA-Z0-9-_\.]+)/([a-zA-Z0-9-_\.]+)(?:@([a-zA-Z0-9-_\./]+))?$");
const tagMatcher = /^v[0-9]+\.[0-9]+\.[0-9][0-9a-zA-Z]*$/;

async function onInstallCommand(repo: (Promise<GitInfo | GithubRepoInfo>) | (GitInfo | GithubRepoInfo), options: {
  quiet: boolean,
  verbose: boolean,
  dependencies: boolean
}): Promise<void> {
  if (options.quiet) {
    logger.setVerbosity('quiet');
  } else if (options.verbose) {
    logger.setVerbosity('verbose');
  } else {
    logger.setVerbosity('normal');
  }
  repo = await repo;

  if (isRepoGithub(repo)) {
    logger.info(`Installing from GitHub repository: https://github.com/${repo.owner}/${repo.repository}`);

    if (!hasAtLeastOne(repo, ["branch", "commitId", "tag"])) {
      //TODO: Auto default branch
      logger.error("You need to specify a repo branch, commitId or tag");
      return;
    }
    if (hasTwoOrMore(repo, ["branch", "commitId", "tag"])) {
      logger.error("You can only specify one of the three: branch, commitId or tag (how did u even do this)");
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

    logger.working('Fetching repository information...');
    logger.detail('Checking for pawn.json in repository...');
    
    try {
      const data = await fetchRepoPawnInfo(repo);
      logger.success('Repository information fetched successfully');
      
      // Show the pawn.json data
      if (options.verbose) {
        logger.detail('Repository pawn.json contents:');
        console.log(JSON.stringify(data, null, 2));
      } else {
        logger.info('Package information retrieved');
        console.log(data);
      }
      
      // Show package details in verbose mode
      if (data.user && data.repo) {
        logger.routine(`Package: ${data.user}/${data.repo}`);
      }
      if (data.dependencies && data.dependencies.length > 0) {
        logger.routine(`Dependencies: ${data.dependencies.join(', ')}`);
      }
      if (data.include_path) {
        logger.routine(`Include path: ${data.include_path}`);
      }
      if (data.resources && data.resources.length > 0) {
        logger.routine(`Resources: ${data.resources.length} platform-specific files`);
        data.resources.forEach((resource: any) => {
          logger.detail(`  - ${resource.name} (${resource.platform})`);
        });
      }
      
    } catch (error: any) {
      logger.error('Failed to fetch repository information');
      
      if (error.code === -3) {
        logger.error('Repository is not a pawn module (no pawn.json found)');
        logger.detail('Make sure the repository contains a pawn.json file in the root directory');
      } else if (error.code === 404) {
        logger.error('Repository not found or pawn.json file missing');
        logger.detail(`Checked URL: https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json`);
      } else if (error.code === -2) {
        logger.error('Network error while fetching repository info');
        logger.detail(`Original error: ${error.error?.message || 'Unknown network error'}`);
      } else {
        logger.error(`Error ${error.code}: ${error.message}`);
        if (error.error) {
          logger.detail(`Details: ${JSON.stringify(error.error, null, 2)}`);
        }
      }
      return;
    }
    
  } else {
    logger.error("Git URL installation not implemented yet");
    logger.detail("Currently only GitHub repositories are supported");
    throw new Error("Not implemented");
  }
}

export default function (program: Command): void {
  program
    .command('install')
    .description('Installs a include or plugin into the project')
    .addArgument(new Argument('<repo>', 'github repository to install')
      .argParser(async (value) => {
        let requestedRepo: GitInfo | GithubRepoInfo;
        const match = repoMatcher.exec(value);
        if (match !== null) {
          logger.routine(`Detected repo as a github repository: https://github.com/${match[1]}/${match[2]}/`);
          if (match[3] != undefined) {
            if (tagMatcher.test(match[3])) {
              logger.routine(`Detected repo with tag ${match[3]}`)
              requestedRepo = { owner: match[1], repository: match[2], tag: match[3] } as GithubRepoInfo;
            } else {
              logger.routine(`Detected repo with branch ${match[3]}`)
              requestedRepo = { owner: match[1], repository: match[2], branch: match[3] } as GithubRepoInfo;
            }
            // TODO: Handle commits (maybe check with API if its valid branch before using as such?)
          } else {
            logger.routine(`Coudn't detect a branch/tag/commit on repo.`);
            logger.routine('Using default branch');
            
            let repoName: string;
            try {
              repoName = await fetchRepoDefaultBranch({ owner: match[1], repository: match[2] } as GithubRepoInfo)
            }
            catch(e)
            {
              logger.error(`Failed to fetch default branch: ${(e as any).message}`);
              logger.error(`Detailed error: ${((e as any).detailed as Error).message}`);
              process.exit();
            }

            requestedRepo = { owner: match[1], repository: match[2], branch: repoName } as GithubRepoInfo;
          }
        } else {
          //Maybe better git link detection?
          logger.routine(`Detected repo as a git link.`);
          requestedRepo = { git: value } as GitInfo
        }
        return requestedRepo;
      })
      .argRequired()
    )
    .option('--no-dependencies', 'do not install dependencies')
    .addOption(new Option('-q, --quiet', 'minimize console output (show only progress bars)').conflicts('verbose'))
    .addOption(new Option('-v, --verbose', 'show detailed debug output').conflicts('quiet'))
    .action(onInstallCommand)
}
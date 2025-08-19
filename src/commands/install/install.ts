import { Argument, Command, Option } from 'commander';
import { logger } from '../../utils/logger';
import { fetchRepoPawnInfo, GithubRepoInfo } from '../../utils/githubHandler';
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

async function onInstallCommand(repo: GitInfo | GithubRepoInfo, options: {
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

    logger.info('Fetching repository pawn.json...');
    const data = await fetchRepoPawnInfo(repo);
    logger.info('Fetched repository pawn.json successfully.');
    console.log(data);
  } else {
    throw new Error("Not implemented");
  }
}


export default function (program: Command): void {
  program
    .command('install')
    .description('Installs a include or plugin into the project')
    .addArgument(new Argument('<repo>', 'github repository to install')
      .argParser((value) => {
        let requestedRepo: GitInfo | GithubRepoInfo;
        const match = repoMatcher.exec(value);
        if (match !== null) {
          logger.routine(`Detected repo as a github repository: https://github.com/${match[1]}/${match[2]}/`);
          if (match[3] !== null) {
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
            requestedRepo = { owner: match[1], repository: match[2] } as GithubRepoInfo;
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
    .addOption(new Option('--verbose', 'show detailed debug output').conflicts('quiet'))
    .action(onInstallCommand)
}
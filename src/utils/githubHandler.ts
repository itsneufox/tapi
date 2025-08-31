import { hasAtLeastOne, hasTwoOrMore } from './general';
import { logger } from './logger';

export type GithubRepoInfo = {
  owner: string;
  repository: string;
  commitId?: string;
  branch?: string;
  tag?: string;
};

export function fetchRepoDefaultBranch(repo: GithubRepoInfo): Promise<string> {
  return fetch(`https://api.github.com/repos/${repo.owner}/${repo.repository}`)
    .then((response) => response.json())
    .then((data) => data['default_branch'])
    .catch((error) => {
      throw {
        code: -1,
        message: 'Failed to fetch default branch',
        detailed: error,
      };
    });
}

export async function fetchRepoPawnInfo(
  repo: GithubRepoInfo
): Promise<Record<string, unknown>> {
  if (!hasAtLeastOne(repo, ['branch', 'commitId', 'tag'])) {
    throw { code: -1, message: 'No reference to the code is specified.' };
  }
  if (hasTwoOrMore(repo, ['branch', 'commitId', 'tag'])) {
    throw {
      code: -1,
      message: 'More than 1 reference to the code is specified.',
    };
  }

  const ref = repo.branch || repo.commitId;
  let url;
  if (ref == undefined) {
    url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json`;
  } else {
    url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json?ref=${ref}`;
  }

  logger.detail(`Making API request to: ${url}`);

  let response: Response;
  try {
    logger.detail('Sending HTTP request...');
    response = await fetch(url, {
      headers: {
        'User-Agent': 'pawnctl - https://github.com/itsneufox/pawnctl/issues',
        Accept: 'application/json',
      },
    });
    logger.detail(
      `Received HTTP response: ${response.status} ${response.statusText}`
    );
  } catch (e) {
    logger.detail(`Network request failed: ${e}`);
    throw {
      code: -2,
      message: 'Failed to fetch repository info',
      error: e,
    };
  }

  if (response.status !== 200) {
    //TODO: Check sampctl if it always use master pawn.json or uses branches/commits ones
    if (response.status === 404) {
      logger.detail('Repository or pawn.json file not found (404)');
      throw { code: -3, message: 'Repository is not a pawn module' };
    }
    //TODO: Handle rate limit
    logger.detail(`API request failed with status ${response.status}`);
    throw {
      code: response.status,
      message: 'Failed to fetch repository info',
      error: await response.json(),
    };
  }

  let data: GithubFileContentResponse;
  try {
    logger.detail('Parsing GitHub API response...');
    data = await response.json();
  } catch (e) {
    logger.detail(`Failed to parse API response: ${e}`);
    throw { code: -4, message: 'Failed to parse response', error: e };
  }

  if (typeof data.download_url !== 'string') {
    logger.detail('Expected file response but got directory listing');
    throw {
      code: -5,
      message: 'Expected file as response, got folder.',
      error: data,
    };
  }

  logger.detail(`Downloading pawn.json from: ${data.download_url}`);

  try {
    response = await fetch(data.download_url, {
      headers: {
        'User-Agent': 'pawnctl - https://github.com/itsneufox/pawnctl/issues',
        Accept: 'application/json',
      },
    });
    logger.detail(
      `pawn.json download response: ${response.status} ${response.statusText}`
    );
  } catch (e) {
    // I Hope we never reach here, we're not supposed.
    logger.detail(`Failed to download pawn.json: ${e}`);
    throw { code: -6, message: 'Failed to fetch pawn.json', error: e };
  }

  try {
    logger.detail('Parsing pawn.json content...');
    data = await response.json();
    logger.detail('Successfully parsed pawn.json');
  } catch (e) {
    logger.detail(`Failed to parse pawn.json: ${e}`);
    throw { code: -7, message: 'Failed to parse pawn.json', error: e };
  }

  return data as unknown as Record<string, unknown>;
}

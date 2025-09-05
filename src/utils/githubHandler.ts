import { promisify } from "node:util";
import { hasAtLeastOne, hasTwoOrMore } from "./general";
import { logger } from "./logger";
import * as fs from "node:fs";
import { pipeline } from 'node:stream';

const streamPipeline = promisify(pipeline);

export type GithubRepoInfo = {
  owner: string;
  repository: string;
  commitId?: string;
  branch?: string;
  tag?: string;
};

function fetchGitHubAPI(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  // TODO: Handle rate limits, with option to bypass local checks maybe
  logger.routine(`Attempting to fetch ${input}`)
  init = {
    ...init,
    headers: {
      ...init?.headers,
      'User-Agent': 'pawnctl - https://github.com/itsneufox/pawnctl/issues',
      'Accept': 'application/json',
    },
  };
  return fetch(input, init);
}

export function DownloadFileFromGitHub(filePath: string, savePath: string, repo: GithubRepoInfo): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const ref = repo.branch || repo.commitId;
    let url;
    if (ref == undefined) {
      url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/${filePath}`;
    } else {
      url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/${filePath}?ref=${ref}`;
    }

    // TODO: add cut animation or some shit (good luck newfox im not doing it)
    const res = await fetchGitHubAPI(url);
    if (!res.ok) {
      reject({ code: res.status, message: `Failed to download file from GitHub: ${res.statusText}` });
      return;
    }
    if (res.body == null) {
      reject("No response body");
      return;
    }
    const dest = fs.createWriteStream(savePath);
    dest.on("error", reject); // TODO: Cleanup
    streamPipeline(res.body, dest).then(resolve).catch(reject);
  });
}


export function fetchRepoDefaultBranch(repo: GithubRepoInfo): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetchGitHubAPI(`https://api.github.com/repos/${repo.owner}/${repo.repository}`);
      const data = await response.json();
      resolve(data["default_branch"]);
    } catch (error) {
      reject({ code: -1, message: "Failed to fetch default branch", detailed: error });
    }
  });
}

export function fetchRepoPawnInfo(repo: GithubRepoInfo): Promise<any> {
  //TODO: Fix type
  return new Promise(async (resolve, reject) => {
    if (!hasAtLeastOne(repo, ['branch', 'commitId', 'tag'])) {
      reject({ code: -1, message: 'No reference to the code is specified.' });
      return;
    }
    if (hasTwoOrMore(repo, ['branch', 'commitId', 'tag'])) {
      reject({
        code: -1,
        message: 'More than 1 reference to the code is specified.',
      });
      return;
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
      response = await fetchGitHubAPI(url);
      logger.detail(
        `Received HTTP response: ${response.status} ${response.statusText}`
      );
    } catch (e) {
      logger.detail(`Network request failed: ${e}`);
      reject({
        code: -2,
        message: 'Failed to fetch repository info',
        error: e,
      });
      return;
    }

    if (response.status !== 200) {
      //TODO: Check sampctl if it always use master pawn.json or uses branches/commits ones
      if (response.status === 404) {
        logger.detail('Repository or pawn.json file not found (404)');
        reject({ code: -3, message: 'Repository is not a pawn module' });
        return;
      }
      //TODO: Handle rate limit
      logger.detail(`API request failed with status ${response.status}`);
      reject({
        code: response.status,
        message: 'Failed to fetch repository info',
        error: await response.json(),
      });
      return;
    }

    let data: GithubFileContentResponse;
    try {
      logger.detail('Parsing GitHub API response...');
      data = await response.json();
    } catch (e) {
      logger.detail(`Failed to parse API response: ${e}`);
      reject({ code: -4, message: 'Failed to parse response', error: e });
      return;
    }

    if (typeof data.download_url !== 'string') {
      logger.detail('Expected file response but got directory listing');
      reject({
        code: -5,
        message: 'Expected file as response, got folder.',
        error: data,
      });
      return;
    }

    logger.detail(`Downloading pawn.json from: ${data.download_url}`);

    try {
      response = await fetchGitHubAPI(data.download_url);
      logger.detail(
        `pawn.json download response: ${response.status} ${response.statusText}`
      );
    } catch (e) {
      // I Hope we never reach here, we're not supposed.
      logger.detail(`Failed to download pawn.json: ${e}`);
      reject({ code: -6, message: 'Failed to fetch pawn.json', error: e });
      return;
    }

    try {
      logger.detail('Parsing pawn.json content...');
      data = await response.json();
      logger.detail('Successfully parsed pawn.json');
    } catch (e) {
      logger.detail(`Failed to parse pawn.json: ${e}`);
      reject({ code: -7, message: 'Failed to parse pawn.json', error: e });
      return;
    }

    resolve(data);
  });
}

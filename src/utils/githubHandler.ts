import { promisify } from "node:util";
import { hasAtLeastOne, hasTwoOrMore } from "./general";
import { logger } from "./logger";
import * as _fs from "node:fs";
import { pipeline } from 'node:stream';
import * as _path from "node:path";

const _streamPipeline = promisify(pipeline);

/**
 * Minimal information required to describe a GitHub repository reference.
 */
export type GithubRepoInfo = {
  owner: string;
  repository: string;
  commitId?: string;
  branch?: string;
  tag?: string;
};

/**
 * Retrieve the default branch name for the provided repository.
 *
 * @param repo - Repository coordinates.
 */
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

/**
 * Fetch and parse the remote pawn.json for a repository, honoring branch/commit/tag hints.
 *
 * @param repo - Repository and ref descriptor.
 * @returns Parsed pawn.json content as a plain object.
 */
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
  if (ref === undefined) {
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
        'User-Agent': 'tapi - https://github.com/itsneufox/tapi/issues',
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
        'User-Agent': 'tapi - https://github.com/itsneufox/tapi/issues',
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

/* Types for release info (thanks chatgpt) */
// https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#get-a-release-by-tag-name
// ---- Shared Types ----

export interface SimpleUser {
  name?: string | null
  email?: string | null
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string | null
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  starred_at?: string
  user_view_type?: string
}

export interface ReactionRollup {
  url: string
  total_count: number
  "+1": number
  "-1": number
  laugh: number
  confused: number
  heart: number
  hooray: number
  eyes: number
  rocket: number
}

// ---- Release Assets ----

export type ReleaseAssetState = "uploaded" | "open"

export interface ReleaseAsset {
  url: string
  browser_download_url: string
  id: number
  node_id: string
  name: string
  label: string | null
  state: ReleaseAssetState
  content_type: string
  size: number
  digest: string | null
  download_count: number
  created_at: string
  updated_at: string
  uploader: SimpleUser | null
}

// ---- Release ----

export interface Release {
  url: string
  html_url: string
  assets_url: string
  upload_url: string
  tarball_url: string | null
  zipball_url: string | null
  id: number
  node_id: string

  tag_name: string
  target_commitish: string
  name: string | null
  body: string | null

  draft: boolean
  prerelease: boolean
  immutable?: boolean

  created_at: string
  published_at: string | null
  updated_at?: string | null

  author: SimpleUser
  assets: ReleaseAsset[]

  body_html?: string
  body_text?: string
  mentions_count?: number
  discussion_url?: string

  reactions?: ReactionRollup
}

import { hasAtLeastOne, hasTwoOrMore } from "./general";

export type GithubRepoInfo = {
    owner: string,
    repository: string,
    commitId?: string,
    branch?: string,
    tag?: string
};

export function fetchRepoPawnInfo(repo: GithubRepoInfo): Promise<any> { //TODO: Fix type
    return new Promise(async (resolve, reject) => {
        if (!hasAtLeastOne(repo, ["branch", "commitId", "tag"])) {
            reject({ code: -1, message: "No reference to the code is specified." });
            return;
        }
        if (hasTwoOrMore(repo, ["branch", "commitId", "tag"])) {
            reject({ code: -1, message: "More than 1 reference to the code is specified." });
            return;
        }

        const ref = repo.branch || repo.commitId;
        let url;
        if (ref == undefined) {
            url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json`
        } else {
            url = `https://api.github.com/repos/${repo.owner}/${repo.repository}/contents/pawn.json?ref=${ref}`
        }

        let response: Response;
        try {
            response = await fetch(url, {
                headers: {
                    "User-Agent": "pawnctl - https://github.com/itsneufox/pawnctl/issues",
                    "Accept": "application/json"
                }
            });
        } catch (e) {
            reject({ code: -2, message: "Failed to fetch repository info", error: e });
            return;
        }

        if (response.status !== 200) {
            //TODO: Check sampctl if it always use master pawn.json or uses branches/commits ones
            if (response.status === 404) {
                reject({ code: -3, message: "Repository is not a pawn module" });
                return;
            }
            //TODO: Handle rate limit

            reject({ code: response.status, message: "Failed to fetch repository info", error: await response.json() });
            return;
        }

        let data: GithubFileContentResponse;
        try {
            data = await response.json();
        } catch (e) {
            reject({ code: -4, message: "Failed to parse response", error: e });
            return;
        }

        if (typeof (data.download_url) !== "string") {
            reject({ code: -5, message: "Expected file as response, got folder.", error: data });
            return;
        }

        try {
            response = await fetch(data.download_url, {
                headers: {
                    "User-Agent": "pawnctl - https://github.com/itsneufox/pawnctl/issues",
                    "Accept": "application/json"
                }
            });
        }
        catch(e)
        {
            // I Hope we never reach here, we're not supposed.
            reject({ code: -6, message: "Failed to fetch pawn.json", error: e });
            return;
        }

        try {
            data = await response.json();
        }
        catch(e)
        {
            reject({ code: -7, message: "Failed to parse pawn.json", error: e });
            return;
        }

        resolve(data);
    });
}
interface GithubFileContentResponse {
  // Thanks api gods https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28&versionId=free-pro-team%40latest&restPage=authenticating-to-the-rest-api#get-repository-content
  type: string;
  size: integer;
  name: string;
  path: string;
  sha: string;
  content: string;
  url: string; //format: 'uri';
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
  entries: {
    type: string;
    size: integer;
    name: string;
    path: string;
    sha: string;
    url: string; //format: 'uri';
    git_url: string | null; //format: 'uri';
    html_url: string | null; //format: 'uri';
    download_url: string | null; //format: 'uri';
    _links: {
      git: string | null; //format: 'uri';
      html: string | null; //format: 'uri';
      self: string; //format: 'uri';
    };
    required: ['git', 'html', 'self'];
  }[];
  encoding: string;
  _links: {
    type: 'object';
    properties: {
      git: string | null; //format: 'uri';
      html: string | null; //format: 'uri';
      self: string; //format: 'uri';
    };
    required: ['git', 'html', 'self'];
  }[];
  encoding: string;
  _links: {
    type: 'object';
    properties: {
      git: string | null; //format: 'uri';
      html: string | null; //format: 'uri';
      self: string; //format: 'uri';
    };
  };
}

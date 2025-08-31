interface GithubFileContentResponse {
  // Thanks api gods https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28&versionId=free-pro-team%40latest&restPage=authenticating-to-the-rest-api#get-repository-content
  type: {
    type: 'string';
  };
  size: {
    type: 'integer';
  };
  name: {
    type: 'string';
  };
  path: {
    type: 'string';
  };
  sha: {
    type: 'string';
  };
  content: {
    type: 'string';
  };
  url: {
    type: 'string';
    format: 'uri';
  };
  git_url: {
    type: ['string', 'null'];
    format: 'uri';
  };
  html_url: {
    type: ['string', 'null'];
    format: 'uri';
  };
  download_url: {
    type: ['string', 'null'];
    format: 'uri';
  };
  entries: {
    type: 'array';
    items: {
      type: 'object';
      properties: {
        type: {
          type: 'string';
        };
        size: {
          type: 'integer';
        };
        name: {
          type: 'string';
        };
        path: {
          type: 'string';
        };
        sha: {
          type: 'string';
        };
        url: {
          type: 'string';
          format: 'uri';
        };
        git_url: {
          type: ['string', 'null'];
          format: 'uri';
        };
        html_url: {
          type: ['string', 'null'];
          format: 'uri';
        };
        download_url: {
          type: ['string', 'null'];
          format: 'uri';
        };
        _links: {
          type: 'object';
          properties: {
            git: {
              type: ['string', 'null'];
              format: 'uri';
            };
            html: {
              type: ['string', 'null'];
              format: 'uri';
            };
            self: {
              type: 'string';
              format: 'uri';
            };
          };
          required: ['git', 'html', 'self'];
        };
      };
      required: [
        '_links',
        'git_url',
        'html_url',
        'download_url',
        'name',
        'path',
        'sha',
        'size',
        'type',
        'url',
      ];
    };
  };
  encoding: {
    type: 'string';
  };
  _links: {
    type: 'object';
    properties: {
      git: {
        type: ['string', 'null'];
        format: 'uri';
      };
      html: {
        type: ['string', 'null'];
        format: 'uri';
      };
      self: {
        type: 'string';
        format: 'uri';
      };
    };
    required: ['git', 'html', 'self'];
  };
}

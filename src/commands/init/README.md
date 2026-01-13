# `init`

Bootstrap an open.mp/SA-MP project (folders, server binaries, compiler, git, editor tasks) in one go.

## Command summary

```bash
tapi init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Project name | Current directory name |
| `-d, --description <description>` | Project description | — |
| `-a, --author <author>` | Author shown in manifests | Configured user name |
| `-q, --quiet` | Minimal console output | `false` |
| `-v, --verbose` | Extra diagnostics | `false` |
| `--skip-compiler` | Skip compiler & stdlib setup | `false` |
| `--legacy-samp` | Prefer SA-MP assets over open.mp | `false` |
| `--preset <name|path>` | Load answers from `.tapi/workflows/init-<name>.yml` (or full path) | — |
| `--accept-preset` | Trust preset defaults, still prompt for missing values | `false` |
| `--non-interactive` | No prompts; fails if data is missing | `false` |

Global flags (`--log-to-file`, etc.) are also honoured.

## Workflows & presets

Automate init by storing configuration in `.tapi/workflows/` (repo) or `~/.tapi/workflows/` (user). Files are discovered in this order:

1. `--preset <name>` → `.tapi/workflows/init-<name>.yml` or `.tapi/workflows/init/<name>.yml`
2. `.tapi/workflows/init.yml`
3. User defaults `~/.tapi/workflows/init-*.yml`

Example:

```yaml
# .tapi/workflows/init-team.yml
project:
  name: ${folder}
  description: "${user}'s staging sandbox"
  initGit: true
  downloadServer: true
compiler:
  downloadCompiler: true
  compilerVersion: latest
  compilerDownloadUrl: "https://internal.example.com/compiler-${platform}.zip?token=${env:TAPI_TOKEN}"
  downloadStdLib: true
  stdLibDownloadUrl: "https://internal.example.com/includes.zip"
options:
  skipCompiler: false
acceptPreset: true
```

See the [Workflows guide](../../../docs/init-presets.md) for the full schema, placeholders, and advanced automation (inheritance, custom downloads, secrets).

### Secrets

`tapi` does not load `.env` automatically. Export environment variables in your shell or CI job before invoking the CLI:

```bash
export TAPI_TOKEN=secret-value
```

## Interactive flow (default mode)

Unless `--non-interactive` is supplied, `init` walks you through:

1. **Project details** – name, description, author
2. **Project type** – gamemode / filterscript / library
3. **Editor integration** – VS Code tasks/debug configs, or skip
4. **Git setup** – create repo + `.gitignore` (optional)
5. **Server package** – download open.mp (or SA-MP when `--legacy-samp`)
6. **Compiler** – choose between bundled or community compiler, handle version conflicts, decide whether to install the stdlib

Workflows pre-fill these answers; missing values still trigger prompts unless `--non-interactive` or `acceptPreset` is used.

## Non-interactive mode

Use `--non-interactive` when automating init (CI/CD, templates). Requirements:

- Every required field must be provided via CLI flags, config defaults, or workflow.
- Download errors or missing values cause the command to exit with a non-zero status.
- Conflicting files abort automatically (no prompts are shown), so start from an empty directory or only safe files.

## Custom download sources

Workflows may override the compiler and standard library URLs. Supported archive formats: `.zip`, `.tar.gz`, `.tgz`. Placeholders:

- `${platform}` → `windows` or `linux`
- `${env:VAR}` → environment variables (for tokens, switches)

If the archive contains an `include/` folder, it is copied; otherwise the root contents are used.

## Output layout

```
project/
├── .tapi/               # tapi metadata (manifest, workflows)
├── compiler/            # optional community compiler (separate installs)
├── qawno/               # compiler shipped with the server package
├── gamemodes/           # main PAWN sources (.pwn / .amx)
├── filterscripts/
├── includes/
├── plugins/
├── scriptfiles/
├── config.json          # open.mp server configuration
├── omp-server.*         # server binaries
└── .vscode/             # tasks & settings (when VS Code selected)
```

## Related commands

- [`tapi build`](../build/README.md) – compiles the sources defined in `pawn.json`
- [`tapi start`](../start/README.md) – runs the configured server with watch mode
- [`tapi config`](../config/README.md) – tweak stored defaults used by `init`

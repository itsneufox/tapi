# tapi

A companion CLI for SA-MP and open.mp projects that finally treats PAWN development like modern tooling.

## Highlights

- **One-command project bootstrap** – `tapi init` scaffolds folders, compiler, server binaries, git, editor tasks.
- **Batteries-included build & run** – `tapi build` and `tapi start` reuse your existing configs; no magic wrappers.
- **Cross-platform by default** – Windows, Linux, macOS; same commands, same output.
- **Extensible via workflows** – drop `.tapi/workflows/init*.yml` in your repo to automate prompts, downloads, or company defaults.
- **Verbose when you need it, quiet otherwise** – consistent logging with `--verbose`, `--quiet`, and file logging.

## Install

> npm package availability is still in progress. For now, clone the repo or link the CLI locally.

```bash
# clone & link for local development
git clone https://github.com/itsneufox/tapi.git
cd tapi
npm install
npm run build
npm run dev         # equivalent to `npm link`
```

After linking you can run `tapi` from any directory.

## Quick start

```bash
# set up global preferences once
$ tapi setup

# start a new project
dir my-gamemode && cd my-gamemode
$ tapi init

# code, rebuild, run
$ tapi build
$ tapi start   # Ctrl+C to stop
```

## Commands

| Command | Purpose | Docs |
|---------|---------|------|
| `setup` | First-time configuration | [📖](src/commands/setup/README.md) |
| `init` | Create projects or reuse workflows | [📖](src/commands/init/README.md) |
| `build` | Compile PAWN sources | [📖](src/commands/build/README.md) |
| `start` | Launch the server (watch mode supported) | [📖](src/commands/start/README.md) |
| `config` | Update saved preferences | [📖](src/commands/config/README.md) |
| `install` | Fetch addons/packages | [📖](src/commands/install/README.md) |
| `kill` | Forcefully stop running servers | [📖](src/commands/kill/README.md) |

Global flags available everywhere: `--verbose`, `--quiet`, and `--log-to-file`.

## Workflows & presets

Automate init (and future commands) with workflow files located at:

```
.tapi/workflows/init.yml          # default
.tapi/workflows/init-team.yml     # invoked via `tapi init --preset team`
.tapi/workflows/init/team.yml     # alternative naming
```

See [Init presets](docs/init-presets.md) for the full schema, placeholder list, and automation examples (custom download URLs, chained defaults, non-interactive runs).

```yaml
# .tapi/workflows/init-team.yml
description: Team defaults for staging servers
project:
  name: ${folder}
  description: "${user}'s staging project"
  initGit: true
  downloadServer: true
compiler:
  downloadCompiler: true
  compilerDownloadUrl: "https://internal.example.com/compiler-${platform}.zip?token=${env:TAPI_TOKEN}"
  downloadStdLib: true
  stdLibDownloadUrl: "https://internal.example.com/includes.zip"
options:
  skipCompiler: false
acceptPreset: true
```

### Secrets

`tapi` does **not** load `.env` files automatically. Export any environment variables referenced in workflows yourself:

```bash
# bash / zsh
export TAPI_TOKEN=secret

# PowerShell
$Env:TAPI_TOKEN = 'secret'
```

## Project layout

`init` creates a ready-to-roll workspace:

```
my-project/
├── .tapi/             # tapi metadata (manifest, workflows)
├── compiler/          # optional community compiler
├── gamemodes/         # gamemode sources (.pwn / .amx)
├── filterscripts/     # filterscript sources
├── includes/          # project-specific includes
├── plugins/
├── scriptfiles/
├── qawno/             # bundled compiler from server package
├── config.json        # open.mp server config
├── omp-server.exe/.sh # server binaries
└── .vscode/           # VS Code tasks & settings (optional)
```

## Additional docs

- [Init command details](src/commands/init/README.md)
- [Workflows & presets](docs/init-presets.md)
- [Command catalogue](src/commands)

## Contributing

Bugs, ideas, PRs are welcome. Check the command-specific READMEs for current limitations and TODOs, or open an issue to discuss larger changes.

## Status

`tapi` is production-quality for development workflows and actively evolving. For production servers, use at your own discretion and pin versions.

---

*Stop fighting your tooling. Build gamemodes faster.*

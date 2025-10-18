# Init Presets

`tapi init` can run from a preset file so teams can reuse the same answers across projects or automate non-interactive setups.

## Where presets are loaded from

When you run `tapi init`, the loader checks for the first preset in this order:

1. A path or preset name passed to `--preset`.
   - An absolute path is used as-is.
   - A relative path is resolved against the current working directory.
   - Otherwise, the name is matched against project presets in `.tapi/workflows/` and finally against global presets in `~/.tapi/workflows/`, using the suffixes `.yml`, `.yaml`, `.json`.
2. Project defaults in `.tapi/workflows/init.*` (falling back to `.tapi/workflows/default.*`).
3. Global defaults in `~/.tapi/workflows/init.*` or `default.*`.

The first file that exists and parses successfully is used. Empty files are rejected.

## CLI flags

| Flag | Description |
| --- | --- |
| `--preset <fileOrName>` | Load answers from a preset file or named preset. |
| `--accept-preset` | Apply preset defaults without forcing full non-interactive mode. Missing answers still trigger prompts. |
| `--non-interactive` | Skip all prompts and run with preset / CLI values only. Fails if required values are missing. |
| `-q, --quiet` | Reduce console output (can also be set from the preset). |
| `--legacy-samp`, `--skip-compiler` | Still honoured; preset values win when CLI flags are not provided. |

## Placeholder reference

You can reference placeholders inside preset strings (project name, description, etc.). At runtime they are replaced with context values:

| Placeholder | Description |
| --- | --- |
| `${folder}` | Basename of the current working directory. |
| `${slug}` | Lowercase / kebab-case version of `${folder}`. |
| `${cwd}` | Absolute path to the current working directory. |
| `${user}` | System username (`os.userInfo`, falling back to `USER`/`USERNAME`). |
| `${hostname}` | Machine hostname. |
| `${date}` | ISO timestamp of the init run. |
| `${timestamp}` | Numeric timestamp (`Date.now()`). |
| `${year}` | 4-digit year. |
| `${gitBranch}` | `git rev-parse --abbrev-ref HEAD` (empty when unavailable). |
| `${projectType}` | `project.projectType` from the preset (empty if not set). |
| `${name}` | The preset project name (useful inside descriptions). |
| `${editor}` | The preset editor value (after defaults). |
| `${env:NAME}` | Value of environment variable `NAME` (empty if unset). |

## Example preset

```yaml
project:
  name: ${folder}
  description: "${user}'s ${projectType} sandbox"
  projectType: gamemode
  editor: VS Code
  initGit: true
  downloadServer: true
compiler:
  downloadCompiler: false
  downloadStdLib: true
options:
  legacySamp: false
  skipCompiler: false
acceptPreset: true
```

Drop this file under `.tapi/workflows/init.yml` (or `init-<name>.yml`) to make it project-specific, or save it in `~/.tapi/workflows/init-<name>.yml` to share it globally.

Project-level locations supported:

- `.tapi/workflows/init.yml` for the default workflow
- `.tapi/workflows/init-<name>.yml` for named variants (called with `tapi init --preset <name>`)
- `.tapi/workflows/init/<name>.yml` (optional subdirectory form, also invoked with `--preset <name>`)

## Usage examples

```bash
# Use project-local preset, allow prompts for missing answers
$tapi init --preset .tapi/workflows/init.yml

# Use global preset called "openmp" (stored as `~/.tapi/workflows/init-openmp.yml`) and accept all defaults
$tapi init --preset openmp --accept-preset

# Fully unattended init (fails if a required value is missing)
$tapi init --preset ci --non-interactive --quiet
```

## Tips

- Presets only fill in values that aren’t already provided on the CLI. Passing `--name` overrides a preset’s `project.name`.
- Non-interactive mode is ideal for CI/CD, but make sure every required field is supplied (name, description, author, etc.).
- Share presets in version control (`.tapi/workflows/init.yml`) to give new contributors a zero-prompt getting started experience.

## Automating downloads

Workflows can override the compiler, standard library, or other downloadable assets. This is handy for private bundles or internal mirrors. URLs may include `${platform}` (resolved to `windows` or `linux`).

```yaml
compiler:
  downloadCompiler: true
  compilerVersion: latest
  compilerDownloadUrl: "https://example.com/compiler-${platform}.zip"
  downloadStdLib: true
  stdLibDownloadUrl: "https://example.com/stdlib.zip"
```

### Secrets and authentication

If a URL needs credentials, load them into the environment before running `tapi`. Workflows can reference them with `${env:VAR}`.

```yaml
compiler:
  compilerDownloadUrl: "https://internal.example.com/compiler-${platform}.zip?token=${env:TAPI_TOKEN}"
```

> `tapi` does **not** read `.env` files automatically. Make sure your shell (or CI pipeline) exports any variables referenced in the workflow first (e.g. `export TAPI_TOKEN=...`).

For interactive sessions, any fields supplied in the workflow are used as prompt defaults; anything missing still triggers a question. In non-interactive mode (or when `acceptPreset` is true) only the values present in the workflow/CLI will be used, and missing required fields will abort the run.

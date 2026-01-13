# `install`

Install reusable project packages from GitHub repositories (zip downloads).

```bash
tapi install <owner/repo[@ref]> [options]
```

## Options

| Flag | Meaning |
|------|---------|
| `-g, --global` | Install into `~/.tapi/packages` instead of the project |
| `--github <owner/repo>` | Explicit GitHub repo (defaults to the positional `<package>` argument) |
| `--ref <branch|tag|sha>` | Install a specific Git ref |
| `--force` | Overwrite existing files |

Packages are extracted under `.tapi/packages/<name>` and merged into your project. Dependencies declared in `pawn.json` are installed recursively.

## Examples

```bash
# latest default branch
tapi install openmultiplayer/omp-stdlib

# install a tag
tapi install openmultiplayer/omp-stdlib@v1.4.0

# install globally (available to all projects)
tapi install openmultiplayer/omp-stdlib --global
```

Use `tapi install --help` for current flags and experimental options.

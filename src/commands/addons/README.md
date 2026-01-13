# `addon` command group

Manage tapi addons (install, update, list, enable/disable). Addons extend the CLI with extra commands, hooks, and project scaffolding.

Addons live alongside workflows; see [`src/core/addons`](../../core/addons) for architecture details.

## Subcommands

| Command | Purpose |
|---------|---------|
| `tapi addon install <name>` | Install an addon from npm, GitHub, or a local path |
| `tapi addon uninstall <name>` | Remove an addon |
| `tapi addon list` | Show installed addons (and status flags) |
| `tapi addon enable <name>` | Enable a previously installed addon |
| `tapi addon disable <name>` | Disable an addon (without uninstalling) |
| `tapi addon recover` | Diagnose or clear addon error state |
| `tapi addon deps` | Inspect/resolve addon dependencies |
| `tapi addon install-deps` | Install missing dependencies |
| `tapi addon update [name]` | Update one or all addons |
| `tapi addon version` | Semver utilities (check, compare, validate) |

> Run `tapi addon --help` for the latest list; new subcommands may be added over time.

## Installation sources

- **npm** (default): `tapi addon install addon-name`
- **GitHub**: `tapi addon install --github user/repo`
- **Local path**: `tapi addon install --local ./path`
- **Scoped workflows**: use `--source` to point at custom registries.

Global installs (`--global`) make an addon available to every project.

## Interaction with the addon manager

All commands use the addon manager (`src/core/addons`) which:

- Tracks installed addons (local + global)
- Handles enable/disable state
- Runs lifecycle hooks during `init`, `build`, etc.

Errors are presented with actionable messages and non-zero exit codes for scripting.

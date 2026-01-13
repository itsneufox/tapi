# `config`

Inspect or change tapi’s stored preferences (author name, editor, GitHub token).

```bash
tapi config [flags]
```

## Flags

| Flag | Description |
|------|-------------|
| `--show` | Print current settings |
| `--author [name]` | Set default author (omit value to prompt) |
| `--editor <name>` | Set preferred editor (`VS Code`, `Sublime Text`, `Other/None`) |
| `--github-token [token]` | Add / update / remove GitHub token |
| `--reset` | Reset configuration to defaults |

Running without flags launches an interactive menu that lets you tweak values one by one. Settings live in `~/.tapi/config.json` and feed into `tapi init`, `tapi install`, etc.

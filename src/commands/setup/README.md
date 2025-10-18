# `setup`

One-time wizard that collects defaults (author name, editor preference, GitHub token).

```bash
tapi setup [--force]
```

- Prompts for author, editor, and optional GitHub token.
- Saves configuration to `~/.tapi/config.json`.
- Run once after installing tapi; use `--force` to re-run and overwrite existing values.

Need to change something later? Use [`tapi config`](../config/README.md).

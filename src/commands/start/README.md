# `start`

Run the open.mp / SA-MP server with process tracking and optional watch mode.

```bash
tapi start [options]
```

## Options

| Flag | Description |
|------|-------------|
| `-c, --config <file>` | Use a specific server config (`config.json`, `server.cfg`, ...) |
| `-e, --existing` | Attach to an already running server tracked by tapi |
| `-w, --window` | Launch in a new OS window (legacy behaviour) |
| `-d, --debug` | Stream verbose server output |
| `--watch` | Watch `.pwn/.inc` files, rebuild, and restart automatically |

### Watch mode

`--watch` monitors `gamemodes/`, `filterscripts/`, and `includes/`:

1. Build (`tapi build`).
2. Start server.
3. On change → stop, rebuild, restart (only if build succeeds).

### Process state

`tapi start` stores metadata in `.tapi/server-state.json` so `--existing` and `tapi kill` know which process to manage. Ctrl+C performs a graceful shutdown; crashes propagate a non-zero exit code with logs left in the terminal.

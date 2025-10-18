# `kill`

Force-stop any running server processes that tapi knows about (or can detect).

```bash
tapi kill [--force]
```

Use when watch mode crashed and left zombies, or when CI needs a clean slate. For normal shutdown use `Ctrl+C` in `tapi start` or attach with `tapi start --existing`.

- Detects `omp-server`, `samp-server`, etc. on Windows/Linux/macOS.
- Sends SIGTERM first, escalates to force kill if needed.
- Clears `.tapi/server-state.json` so the next `tapi start` begins fresh.

`--force` skips the confirmation prompt. Use carefully in scripts.

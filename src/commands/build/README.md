# `build`

Compile PAWN sources into AMX bytecode using the configuration in `pawn.json`.

```bash
tapi build [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input <file>` | Source `.pwn` to compile | `compiler.input` |
| `-o, --output <file>` | Output `.amx` path | `compiler.output` |
| `-d, --debug <0-3>` | Debug info level | `3` |
| `-p, --profile <name>` | Use build profile | first profile / defaults |
| `--list-profiles` | Show available profiles | — |

Global flags (`--verbose`, `--quiet`, `--log-to-file`) also apply.

### Include priority

1. `pawno/include`
2. `qawno/include`
3. `compiler/include`
4. Paths from `compiler.includes`

### Default compiler flags

```
-d3 -;+ -(+ -\+ -Z+
```

Override via profiles or CLI.

### Profiles

Profiles live under `compiler.profiles` in `pawn.json`:

```json
{
  "compiler": {
    "profiles": {
      "dev": { "options": ["-d3"] },
      "prod": {
        "options": ["-d0", "-O1"],
        "output": "dist/my-gamemode.amx"
      }
    }
  }
}
```

Use `tapi build --profile prod` or list them with `tapi build --list-profiles`.

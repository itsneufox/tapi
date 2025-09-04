# pawnctl

A command-line tool that doesn't suck for SA-MP and open.mp development.

## What's this?

Tired of wrestling with PAWN compiler setups, server configurations, and the general pain of SA-MP/open.mp development? Yeah, me too. That's why pawnctl exists.

It's basically a CLI that handles all the boring stuff so you can focus on actually writing code.

## Why should I care?

- **No more manual setup hell** - `pawnctl init` and you're coding in seconds
- **Server runs in your terminal** - like a real dev server, Ctrl+C to stop
- **Actually works cross-platform** - Windows, Linux, macOS, whatever
- **Doesn't hijack your workflow** - uses standard server configs, no lock-in
- **Clean output** - no spam unless you want it (`--verbose`)

## Getting started

```bash
# Set it up (just once)
pawnctl setup

# Make a project
mkdir my-gamemode && cd my-gamemode
pawnctl init

# Code, build, run
pawnctl build
pawnctl start    # Ctrl+C to stop, that's it
```

## Commands

| Command | What it does | Docs |
|---------|--------------|------|
| `setup` | First-time configuration | [📖](src/commands/setup/README.md) |
| `init` | Create new projects | [📖](src/commands/init/README.md) |
| `build` | Compile your PAWN code | [📖](src/commands/build/README.md) |
| `start` | Run the server | [📖](src/commands/start/README.md) |
| `config` | Change settings | [📖](src/commands/config/README.md) |
| `install` | Grab packages from GitHub | [📖](src/commands/install/README.md) |
| `kill` | Emergency cleanup | [📖](src/commands/kill/README.md) |

## Daily workflow

```bash
# Start project
pawnctl init

# Work on code...
# (edit your .pwn files)

# Test it
pawnctl build
pawnctl start    # server runs right here in terminal

# Install some library
pawnctl install openmultiplayer/omp-stdlib

# Back to coding...
```

## What you get

When you run `init`, you get a complete setup:
- Server (SA-MP or open.mp, your choice)
- PAWN compiler that actually works
- Proper folder structure
- VS Code integration if you want it
- Git repo with sensible .gitignore
- No weird custom configs - just standard server files

## Requirements

- Node.js (recent version)
- That's it

## Contributing

Found a bug? Got an idea? Cool, let's talk. Check the command docs to see what needs work.

## Status

This is real software that works, but it's still evolving. Don't put it on your production server (yet), but it's great for development.

---

*Stop fighting with tooling, start writing gamemodes.*
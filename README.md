# pawnctl Documentation

## Introduction

pawnctl is a command-line interface tool for SA-MP/open.mp development that helps manage packages and build PAWN projects. It streamlines the workflow for PAWN developers by providing a set of commands for project initialization, building, and server management.

> ⚠️ **WARNING**: This tool is currently in development and may contain bugs and has incomplete features. DON'T USE ON PRODUCTION SERVERS!!!

## Overview

pawnctl simplifies the workflow for open.mp and SA-MP developers by providing tools to:
- Initialize new projects with proper structure
- Build PAWN code with optimized compiler settings
- Manage server instances
- Set up development environments with VS Code integration

## Installation

### Prerequisites
- Node.js (v22.14.0 or compatible)
- npm (v11.2.0 or compatible)

These specific versions have been tested and are known to work well with pawnctl. Using these exact versions will help ensure compatibility and prevent unexpected issues during development.

### Installing pawnctl

```bash
npm install -g pawnctl
```

## For Developers

To set up the project for development:

1. Clone this repository:
   ```bash
   git clone https://github.com/itsneufox/pawnctl.git
   cd pawnctl
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Create a symlink to use the development version globally:
   ```bash
   npm link
   ```
   This will allow you to run `pawnctl` from anywhere while working on the source code.

5. To unlink after development:
   ```bash
   npm unlink -g pawnctl
   ```

## Development Commands

The project includes several npm scripts for development:

```bash
npm run build         # Compile TypeScript and copy templates
npm run lint          # Run ESLint on TypeScript files
npm run format        # Run Prettier to format code
```

## Commands

### init

Initializes a new open.mp project with the necessary directory structure and configuration files.

```bash
pawnctl init [options]
```

Options:
- `-n, --name <name>` - Project name
- `-d, --description <description>` - Project description
- `-a, --author <author>` - Project author
- `-q, --quiet` - Minimize console output (show only progress bars)
- `-v, --verbose` - Show detailed debug output

The init command will guide you through an interactive setup process:
1. Asks for project details (name, description, author)
2. Lets you select the project type (gamemode, filterscript, or library)
3. Sets up editor configuration (VS Code, Sublime Text, or other)
4. Optionally initializes a Git repository
5. Downloads the open.mp server package if desired
6. Downloads the community PAWN compiler
7. Downloads the open.mp standard library

### build

Compiles your PAWN code using the PAWN compiler.

```bash
pawnctl build [options]
```

Options:
- `-i, --input <file>` - Input .pwn file to compile
- `-o, --output <file>` - Output .amx file
- `-d, --debug <level>` - Debug level (1-3, default is 3)
- `-v, --verbose` - Show detailed debug output

If no input file is specified, pawnctl will use the entry point defined in pawn.json.

You can also press CTRL+SHIFT+B in VS Code if you've set up the VS Code integration.

### start

Starts the open.mp server.

```bash
pawnctl start [options]
```

Options:
- `-c, --config <file>` - Specify a custom config file (default is config.json)
- `-d, --debug` - Start with debug output
- `-e, --existing` - Connect to existing server if running
- `-w, --window` - Force start in a new window instead of terminal
- `-v, --verbose` - Show detailed debug output

You can also press F5 in VS Code if you've set up the VS Code integration.

## Advanced Options

Each command supports additional options. You can use `--help` with any command to see available options:

```bash
pawnctl init --help
pawnctl build --help
pawnctl start --help
```

Add `--verbose` to any command for detailed output:

```bash
pawnctl init --verbose
pawnctl build --verbose
pawnctl start --verbose
```

## Project Structure

After initializing a project with `pawnctl init`, your project will have the following structure:

```
your-project/
├── gamemodes/               # Gamemode source files
│   └── your-gamemode.pwn    # Main gamemode source file
├── filterscripts/           # Filterscript source files
├── includes/                # Include files
├── plugins/                 # Server plugins
├── scriptfiles/             # Server data files
├── compiler/                # Community PAWN compiler files
├── omp-server(.exe)         # open.mp server executable
├── config.json              # Server configuration
└── .pawnctl/                # pawnctl configuration folder
    ├── start-server.js      # Server startup script
    └── pawn.json            # Project manifest
```

## Configuration

### pawn.json

The project manifest file contains the configuration for your PAWN project:

```json
{
  "name": "your-project",
  "version": "1.0.0",
  "description": "Your project description",
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {},
  "entry": "gamemodes/your-project.pwn",
  "output": "gamemodes/your-project.amx",
  "scripts": {
    "build": "pawnctl build",
    "test": "pawnctl test",
    "run": "pawnctl run"
  },
  "compiler": {
    "input": "gamemodes/your-project.pwn",
    "output": "gamemodes/your-project.amx",
    "includes": ["includes", "gamemodes"],
    "constants": {
      "MAX_PLAYERS": 50,
      "DEBUG": 1
    },
    "options": ["-d3", "-;+", "-(+", "-\\+", "-Z+"]
  }
}
```

## VS Code Integration

When selecting VS Code as your editor during initialization, pawnctl sets up:

1. Tasks for building your PAWN code (Ctrl+Shift+B)
2. Launch configurations for starting the server (F5)
3. Editor settings optimized for PAWN development

This includes:
- Creating tasks.json for build tasks
- Creating launch.json for debugging
- Setting up settings.json with PAWN file associations
- Adding a start-server.js helper script

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

When contributing:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting:
   ```bash
   npm run lint
   npm run format
   ```
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
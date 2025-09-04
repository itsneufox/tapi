# `init` Command

Initialize a new open.mp project with proper directory structure, server files, and development environment setup.

## Overview

The `init` command is the primary way to create new open.mp projects. It sets up everything you need to start developing PAWN code for open.mp servers, including:

- Project directory structure
- open.mp server package
- PAWN compiler and standard library
- VS Code integration (optional)
- Git repository (optional)
- Project configuration files

## Usage

```bash
pawnctl init [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Project name | Current directory name |
| `-d, --description <description>` | Project description | - |
| `-a, --author <author>` | Project author | From user preferences |
| `-q, --quiet` | Minimize console output | false |
| `--skip-compiler` | Skip compiler setup and use default settings | false |
| `-v, --verbose` | Show detailed debug output | false |

## Interactive Prompts

The `init` command uses interactive prompts to gather project information:

### 1. Project Information
- **Project name**: Name of your project (used for files and directories)
- **Project description**: Brief description of what your project does
- **Author**: Your name (defaults to user preference)

### 2. Project Type
Choose from:
- **gamemode**: Main server gamemode (most common)
- **filterscript**: Server-side script for specific functionality
- **library**: Include library for other projects

### 3. Editor Setup
- **VS Code**: Full integration with tasks, debugging, and IntelliSense
- **Sublime Text**: Basic configuration
- **Other/None**: No editor-specific setup

### 4. Git Repository
- **Yes**: Initialize Git repository with .gitignore
- **No**: Skip Git setup

### 5. Server Package
- **Yes**: Download and extract open.mp server package
- **No**: Skip server setup (manual setup required)

### 6. Compiler Setup
- **Download community compiler**: Install latest community PAWN compiler
- **Compiler version**: Specific version or "latest"
- **Installation location**: qawno/ (replace server's) or compiler/ (separate)
- **Standard library**: Download open.mp standard library

## Smart Version Conflict Detection

The `init` command intelligently handles compiler version conflicts:

### How It Works
1. **Detects existing compiler**: Checks if qawno/ directory exists
2. **Compares versions**: Compares server package compiler vs community compiler
3. **Presents options**: Offers appropriate choices based on version comparison

### Version Conflict Scenarios

#### Downgrade Detected (Server > Community)
```
⚠️  Version conflict detected!
   Server package includes: 3.10.11
   Community compiler version: 3.10.10
   Installing community compiler would be a downgrade!

How would you like to handle this version conflict?
✔ Select an option › Keep server's compiler (3.10.11) - recommended
```

**Options:**
- **Keep server's compiler**: Preserve the newer version (recommended)
- **Replace with community compiler**: Downgrade to older version (not recommended)
- **Install both**: Keep server's and install community in compiler/ folder

#### Upgrade Available (Server < Community)
```
Server has 3.10.10, community compiler is 3.10.11. Replace server's compiler?
✔ Yes/No › Yes
```

#### Same Version (No Conflict)
```
✓ Compiler versions match (3.10.11). Keeping existing compiler.
```

## Project Structure Created

```
project-name/
├── gamemodes/               # Gamemode source files
│   └── project-name.pwn     # Main gamemode file
├── filterscripts/           # Filterscript source files
├── includes/                # Include files
├── plugins/                 # Server plugins
├── scriptfiles/             # Server data files
├── qawno/                   # PAWN compiler files
│   ├── pawncc.exe          # Compiler executable
│   ├── pawnc.dll           # Compiler library
│   └── include/            # Standard library
├── compiler/                # Community compiler (if installed separately)
├── omp-server.exe          # open.mp server executable
├── config.json             # Server configuration
├── .pawnctl/               # pawnctl configuration
│   └── pawn.json           # Project manifest
└── .vscode/                # VS Code configuration (if selected)
    ├── tasks.json          # Build tasks
    └── settings.json       # Editor settings
```

## Configuration Files

### pawn.json (Project Manifest)
```json
{
  "name": "my-gamemode",
  "version": "1.0.0",
  "description": "A new open.mp gamemode",
  "author": "Developer",
  "license": "MIT",
  "entry": "gamemodes/my-gamemode.pwn",
  "output": "gamemodes/my-gamemode.amx",
  "compiler": {
    "input": "gamemodes/my-gamemode.pwn",
    "output": "gamemodes/my-gamemode.amx",
    "includes": ["includes", "gamemodes"],
    "constants": {
      "MAX_PLAYERS": 50,
      "DEBUG": 1
    },
    "options": ["-d3", "-;+", "-(+", "-\\+", "-Z+"]
  }
}
```

### config.json (Server Configuration)
```json
{
  "hostname": "open.mp Server",
  "language": "English",
  "maxplayers": 50,
  "port": 7777,
  "rcon_password": "changeme",
  "password": "",
  "announce": true,
  "chatlogging": true,
  "weburl": "https://open.mp",
  "onfoot_rate": 30,
  "incar_rate": 30,
  "weapon_rate": 30,
  "stream_distance": 300.0,
  "stream_rate": 1000,
  "maxnpc": 0,
  "logtimeformat": "[%H:%M:%S]",
  "language": "English",
  "rcon": true,
  "rcon_password": "changeme",
  "password": "",
  "admin_password": "changeme",
  "announce": true,
  "chatlogging": true,
  "weburl": "https://open.mp",
  "onfoot_rate": 30,
  "incar_rate": 30,
  "weapon_rate": 30,
  "stream_distance": 300.0,
  "stream_rate": 1000,
  "maxnpc": 0,
  "logtimeformat": "[%H:%M:%S]",
  "plugins": [],
  "filterscripts": [],
  "pawn": {
    "main_scripts": ["gamemodes/my-gamemode"],
    "auto_reload": true
  }
}
```

## Error Handling

### Interruption Recovery
If you press Ctrl+C during the initialization process, pawnctl will:
1. **Detect the interruption**
2. **Use sensible defaults** for remaining options
3. **Continue the process** with default settings
4. **Complete initialization** successfully

### Common Error Scenarios

#### Network Issues
```
✗ Failed to download server package
  Error: Network timeout
  Solution: Check your internet connection and try again
```

#### Permission Issues
```
✗ Failed to create directory: gamemodes/
  Error: EACCES: permission denied
  Solution: Check directory permissions or run as administrator
```

#### Disk Space Issues
```
✗ Failed to extract server package
  Error: ENOSPC: no space left on device
  Solution: Free up disk space and try again
```

## Verbosity Levels

### Normal Mode (Default)
```bash
pawnctl init
```
- Clean, minimal output
- Progress bars for downloads
- Essential success messages only

### Quiet Mode
```bash
pawnctl init --quiet
```
- Minimal output
- Only critical messages and progress bars
- Perfect for automated scripts

### Verbose Mode
```bash
pawnctl init --verbose
```
- Detailed logging
- File operation details
- Debug information
- Redirect URLs and technical details

## Examples

### Basic Project Initialization
```bash
$ pawnctl init

=== Initializing new open.mp project... ===
✔ Project name: my-gamemode
✔ Project description: A new open.mp gamemode
✔ Author: Developer
✔ Project type: gamemode
✔ Which editor are you using? VS Code
✔ Initialize Git repository? Yes
✔ Add open.mp server package? Yes

--- Setting up your project... ---
ℹ Created pawn.json manifest file
✔ VS Code configuration created
✓ Project files and structure created
✔ Found open.mp version v1.4.0.2779
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 29984/29984 KB
✔ Copied 13 server files to project
✔ Extracting server package...

🎉 Server installation complete!
  Server executable: omp-server.exe
  Configuration: config.json

✔ Download community pawn compiler? Yes
✔ Enter the compiler version (or "latest" for the latest version): latest
✔ Install community compiler in compiler/ folder? No
✔ Download open.mp standard library? Yes

--- Compiler installation summary: ---
  Result: qawno/ (preserved)
✓ Compiler installed
✓ Standard library installed
✔ Server configuration updated
✔ Cleanup complete

🎉 Project initialized successfully!
```

### Quick Setup with Options
```bash
$ pawnctl init --name my-server --description "My awesome server" --author "CoolDev" --quiet

Downloading [████████████████████████████████████████] 100% | ETA: 0s | 29984/29984 KB
🎉 Project initialized successfully!
```

### Skip Compiler Setup
```bash
$ pawnctl init --skip-compiler

=== Initializing new open.mp project... ===
✔ Project name: my-gamemode
✔ Project description: A new open.mp gamemode
✔ Author: Developer
✔ Project type: gamemode
✔ Which editor are you using? VS Code
✔ Initialize Git repository? Yes
✔ Add open.mp server package? Yes

--- Setting up your project... ---
ℹ Created pawn.json manifest file
✔ VS Code configuration created
✓ Project files and structure created
✔ Found open.mp version v1.4.0.2779
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 29984/29984 KB
✔ Copied 13 server files to project
✔ Extracting server package...

🎉 Server installation complete!
  Server executable: omp-server.exe
  Configuration: config.json

ℹ Skipping compiler setup. Using default settings.
✔ Server configuration updated
✔ Cleanup complete

🎉 Project initialized successfully!
```

## Next Steps

After running `pawnctl init`, you can:

1. **Edit your code**: Open the generated .pwn file in your editor
2. **Build your project**: Run `pawnctl build` to compile
3. **Start the server**: Run `pawnctl start` to launch the server
4. **Install packages**: Use `pawnctl install` to add dependencies

## Troubleshooting

### Common Issues

#### "No pawn.json manifest found"
**Cause**: Not in a pawnctl project directory
**Solution**: Run `pawnctl init` to create a new project

#### "Server executable not found"
**Cause**: Server package wasn't downloaded or extracted properly
**Solution**: Re-run `pawnctl init` or manually download server files

#### "Compiler version conflict"
**Cause**: Server package has different compiler version than community
**Solution**: Choose appropriate option in the version conflict prompt

#### "Permission denied"
**Cause**: Insufficient permissions to create files/directories
**Solution**: Run as administrator or check directory permissions

### Getting Help

- **Verbose mode**: Use `--verbose` for detailed error information
- **Clean slate**: Delete project directory and re-run `pawnctl init`
- **Manual setup**: Use `--skip-compiler` to bypass problematic steps

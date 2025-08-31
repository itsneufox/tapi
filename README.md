# pawnctl

A powerful command-line interface tool for SA-MP/open.mp development that streamlines the workflow for PAWN developers.

## 🚀 Features

- **Project Management**: Initialize, build, and manage open.mp projects
- **Smart Compiler Management**: Intelligent version conflict detection and resolution
- **Package Management**: Install packages from GitHub repositories
- **Server Management**: Start and manage open.mp server instances
- **Configuration Management**: User preferences and project settings
- **VS Code Integration**: Complete development environment setup
- **Verbosity Control**: Clean output with detailed logging when needed
- **Error Recovery**: Graceful handling of interruptions and errors
- **GitHub Integration**: Package installation and repository management

## 📋 Prerequisites

- **Node.js**: v22.14.0 or compatible
- **npm**: v11.2.0 or compatible

> ⚠️ **Note**: These specific versions have been tested and are known to work well with pawnctl. Using these exact versions will help ensure compatibility.

## 🛠️ Installation

### Global Installation

```bash
npm install -g pawnctl
```

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/itsneufox/pawnctl.git
   cd pawnctl
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Create development symlink**:
   ```bash
   npm link
   ```

5. **Unlink when done**:
   ```bash
   npm unlink -g pawnctl
   ```

## 🎯 Quick Start

1. **First-time setup**:
   ```bash
   pawnctl setup
   ```

2. **Initialize a new project**:
   ```bash
   pawnctl init
   ```

3. **Build your code**:
   ```bash
   pawnctl build
   ```

4. **Start the server**:
   ```bash
   pawnctl start
   ```

## 📖 Commands

### `setup` - Initial Configuration

Configure pawnctl settings for first-time use.

```bash
pawnctl setup [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Force setup even if already configured |

#### Features

- **Default Author**: Set your name for new projects
- **Editor Preference**: Choose your preferred code editor
- **GitHub Integration**: Configure GitHub token for package installation
- **One-time Setup**: Runs automatically on first use

#### Example

```bash
$ pawnctl setup

Welcome to pawnctl!
This one-time setup will help configure pawnctl for your use.

✔ What name would you like to use as the default author for your projects? Developer
✔ Which code editor do you use most for PAWN development? VS Code
✔ Would you like to configure GitHub integration? Yes
✔ Enter your GitHub personal access token: ****************

Setup complete! You can now use pawnctl.
```

### `init` - Initialize New Project

Creates a new open.mp project with proper directory structure and configuration.

```bash
pawnctl init [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Project name | Current directory name |
| `-d, --description <description>` | Project description | - |
| `-a, --author <author>` | Project author | - |
| `-q, --quiet` | Minimize console output | false |
| `--skip-compiler` | Skip compiler setup | false |
| `-v, --verbose` | Show detailed debug output | false |

#### Features

- **Smart Version Detection**: Automatically detects compiler version conflicts
- **Interactive Setup**: Guided configuration with sensible defaults
- **Error Recovery**: Continues with default settings if interrupted (Ctrl+C)
- **Verbosity Control**: Clean output in normal mode, detailed logging in verbose mode
- **Project Types**: Support for gamemode, filterscript, and library projects
- **Editor Integration**: Automatic VS Code, Sublime Text, or custom setup

#### Example Output

```bash
$ pawnctl init

██╗         ██████╗  █████╗ ██╗    ██╗███╗   ██╗ ██████╗████████╗██╗
╚██╗        ██╔══██╗██╔══██╗██║    ██║████╗  ██║██╔════╝╚══██╔══╝██║
 ╚██╗       ██████╔╝███████║██║ █╗ ██║██╔██╗ ██║██║        ██║   ██║
 ██╔╝       ██╔═══╝ ██╔══██║██║███╗██║██║╚██╗██║██║        ██║   ██║
██╔╝███████╗██║     ██║  ██║╚███╔███╔╝██║ ╚████║╚██████╗   ██║   ███████╗
╚═╝ ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚══════╝

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

--- Next steps: ---
  • Edit your gamemode in gamemodes/my-gamemode.pwn
  • Run "pawnctl build" to compile your code
  • Press Ctrl+Shift+B in VS Code to run the build task
  • Press F5 to start the server
```

### `build` - Compile PAWN Code

Compiles your PAWN code using the PAWN compiler.

```bash
pawnctl build [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <file>` | Input .pwn file to compile | From pawn.json |
| `-o, --output <file>` | Output .amx file | From pawn.json |
| `-d, --debug <level>` | Debug level (1-3) | 3 |
| `-v, --verbose` | Show detailed debug output | false |

#### Features

- **Configuration-Driven**: Uses pawn.json for compiler settings
- **Error Reporting**: Clear error messages with file and line numbers
- **Cross-Platform**: Works on Windows and Linux
- **Optimized Compilation**: Pre-configured compiler options for open.mp

#### Examples

```bash
# Build using pawn.json configuration
pawnctl build

# Build specific file
pawnctl build -i gamemodes/my-gamemode.pwn

# Build with custom debug level
pawnctl build -d 2

# Build with verbose output
pawnctl build --verbose
```

### `start` - Start Server

Starts the open.mp server with intelligent process management.

```bash
pawnctl start [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <file>` | Custom config file | config.json |
| `-d, --debug` | Start with debug output | false |
| `-e, --existing` | Connect to existing server | false |
| `-w, --window` | Force start in new window | false |
| `-v, --verbose` | Show detailed debug output | false |

#### Features

- **Process Management**: Tracks server state and prevents multiple instances
- **Cross-Platform**: Supports Windows, Linux, and macOS
- **VS Code Integration**: Automatic window management for VS Code users
- **Configuration Support**: Custom config files and debug modes
- **Error Recovery**: Graceful handling of server startup issues

#### Examples

```bash
# Start server with default config
pawnctl start

# Start with debug output
pawnctl start --debug

# Start with custom config
pawnctl start -c my-config.json

# Start in new window
pawnctl start --window
```

### `config` - Manage Configuration

Manage pawnctl user preferences and settings.

```bash
pawnctl config [options]
```

#### Features

- **Default Author**: Set your name for new projects
- **Editor Preference**: Choose your preferred code editor
- **GitHub Integration**: Configure GitHub token for package installation
- **Configuration Display**: View current settings
- **Reset Options**: Reset configuration to defaults

#### Interactive Options

```bash
$ pawnctl config

Current pawnctl configuration:
• Default author: Developer
• Preferred editor: VS Code
• GitHub integration: Configured
• Setup complete: Yes

What would you like to configure?
✔ Select an option › Default author
✔ Enter your default author name: New Developer
✓ Default author updated to: New Developer
```

### `install` - Package Management

Install packages from GitHub repositories.

```bash
pawnctl install <repository> [options]
```

#### Repository Format

```
owner/repository[@branch|@tag|@commit]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dependencies` | Install dependencies recursively | false |
| `-v, --verbose` | Show detailed debug output | false |

#### Features

- **GitHub Integration**: Direct installation from GitHub repositories
- **Version Control**: Support for branches, tags, and commits
- **Dependency Management**: Recursive dependency installation
- **Cross-Platform**: Automatic platform detection and file selection
- **Validation**: Checks for pawn.json and proper package structure

#### Examples

```bash
# Install from GitHub repository
pawnctl install openmultiplayer/omp-stdlib

# Install specific branch
pawnctl install owner/repo@develop

# Install specific tag
pawnctl install owner/repo@v1.0.0

# Install with dependencies
pawnctl install owner/repo --dependencies
```

## 🏗️ Project Structure

After running `pawnctl init`, your project will have this structure:

```
my-project/
├── gamemodes/               # Gamemode source files
│   └── my-gamemode.pwn     # Main gamemode file
├── filterscripts/           # Filterscript source files
├── includes/                # Include files
├── plugins/                 # Server plugins
├── scriptfiles/             # Server data files
├── qawno/                   # PAWN compiler files
│   ├── pawncc.exe          # Compiler executable
│   ├── pawnc.dll           # Compiler library
│   └── include/            # Standard library
├── omp-server.exe          # open.mp server executable
├── config.json             # Server configuration
├── pawn.json               # Project manifest
├── .pawnctl/               # pawnctl configuration
│   ├── start-server.js     # Server startup script
│   └── pawn.json           # Project manifest
└── .vscode/                # VS Code configuration
    ├── tasks.json          # Build tasks
    ├── launch.json         # Debug configuration
    └── settings.json       # Editor settings
```

## ⚙️ Configuration

### pawn.json

The project manifest contains your PAWN project configuration:

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

### User Configuration

User preferences are stored in `~/.pawnctl/preferences.json`:

```json
{
  "defaultAuthor": "Developer",
  "editor": "VS Code",
  "githubToken": "ghp_...",
  "setupComplete": true
}
```

## 🔧 VS Code Integration

When you select VS Code during initialization, pawnctl sets up:

- **Build Tasks** (Ctrl+Shift+B): Compile your PAWN code
- **Debug Configuration** (F5): Start the server with debugging
- **File Associations**: Proper syntax highlighting for .pwn files
- **IntelliSense**: Code completion and error detection
- **Integrated Terminal**: Server management within VS Code

## 🎛️ Verbosity Levels

pawnctl supports three verbosity levels:

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

## 🚨 Smart Version Conflict Detection

pawnctl intelligently handles compiler version conflicts:

- **Automatic Detection**: Compares server package compiler version with community compiler
- **Conflict Resolution**: Offers three options when versions conflict:
  - Keep server's compiler (recommended)
  - Replace with community compiler (not recommended)
  - Install both (community in compiler/ folder)
- **No Downgrades**: Warns against installing older compiler versions

## 🛡️ Error Handling

- **Graceful Interruptions**: If you press Ctrl+C during setup, pawnctl uses sensible defaults
- **Error Recovery**: Continues initialization even if some steps fail
- **Detailed Error Messages**: Clear information about what went wrong
- **Fallback Options**: Multiple paths for template and file locations
- **Process Management**: Prevents multiple server instances and handles crashes

## 🔧 Utilities

### Logger System

Comprehensive logging with multiple levels:
- **Error**: Critical issues that prevent operation
- **Warn**: Non-critical issues that may affect functionality
- **Info**: General information and status updates
- **Success**: Successful operations
- **Detail**: Detailed information (verbose mode only)
- **Routine**: Routine operations and progress

### Configuration Manager

Centralized configuration management:
- **User Preferences**: Default author, editor, GitHub token
- **Project Settings**: Compiler options, include paths, constants
- **Persistence**: Automatic saving and loading of settings
- **Validation**: Input validation and error handling

### GitHub Handler

GitHub API integration for package management:
- **Repository Information**: Fetch repository metadata
- **File Download**: Download specific files from repositories
- **Branch/Tag Support**: Support for different repository references
- **Rate Limiting**: Respects GitHub API rate limits

### Server State Management

Process management for server instances:
- **State Tracking**: Monitor server running status
- **Process Control**: Start, stop, and manage server processes
- **Cross-Platform**: Works on Windows, Linux, and macOS
- **Error Recovery**: Handle server crashes and restarts

## 🧪 Development

### Available Scripts

```bash
npm run build         # Compile TypeScript and copy templates
npm run lint          # Run ESLint on TypeScript files
npm run format        # Run Prettier to format code
```

### Project Structure

```
src/
├── commands/          # Command implementations
│   ├── init/         # Project initialization
│   ├── build/        # PAWN compilation
│   ├── start/        # Server management
│   ├── config/       # Configuration management
│   ├── install/      # Package management
│   └── setup/        # Initial setup
├── utils/            # Utility functions
│   ├── logger.ts     # Logging system
│   ├── config.ts     # Configuration management
│   ├── banner.ts     # ASCII art banner
│   ├── githubHandler.ts # GitHub API integration
│   └── serverState.ts # Server process management
└── templates/        # Project templates
    ├── projects/     # Project type templates
    ├── common/       # Common files
    └── vscode/       # VS Code configuration
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting:
   ```bash
   npm run lint
   npm run format
   ```
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

> **WARNING**: This tool is currently in development and may contain bugs and incomplete features. DON'T USE ON PRODUCTION SERVERS!!!
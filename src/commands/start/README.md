# `start` Command

Start the open.mp server with intelligent process management, cross-platform support, and integrated development environment features.

## Overview

The `start` command launches the SA-MP or open.mp server with proper configuration, process management, and development-friendly features. By default, the server runs inline in the current terminal with real-time output and interactive control. It handles server state tracking, prevents multiple instances, and provides graceful shutdown handling.

## Usage

```bash
tapi start [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <file>` | Custom config file | config.json |
| `-e, --existing` | Connect to existing server | false |
| `-w, --window` | Start in new window (legacy mode) | false |
| `-d, --debug` | Start with debug output | false |
| `--watch` | Watch files and auto-rebuild + restart | false |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --verbose` | Show detailed debug output | false |
| `-q, --quiet` | Minimize console output (show only progress bars) | false |
| `--log-to-file` | Save logs to file for debugging | false |

## Features

### Watch Mode

- **Auto-rebuild**: Detects changes to `.pwn` and `.inc` files
- **Auto-restart**: Rebuilds and restarts server after file changes
- **Smart monitoring**: Watches `gamemodes/`, `filterscripts/`, `includes/` directories
- **Build validation**: Only restarts if build succeeds
- **Development-friendly**: Perfect for rapid iteration during development

### Process Management

- **State Tracking**: Monitors server running status
- **Instance Prevention**: Prevents multiple server instances
- **Graceful Shutdown**: Handles Ctrl+C and process termination
- **Crash Recovery**: Detects and reports server crashes

### Cross-Platform Support

- **Windows**: Native process management and window handling
- **Linux**: Terminal-based server management
- **macOS**: Unix-compatible process handling

### Real-time Output & Control

- **Inline Terminal**: Server runs directly in your terminal by default
- **Live Output**: See server logs and messages in real-time
- **Interactive Control**: Send commands directly to the server
- **Graceful Shutdown**: Clean server stop with Ctrl+C

### Configuration Support

- **Custom Config Files**: Use different server configurations

- **Argument Passing**: Pass custom arguments to server

## Server Startup Process

### 1. Pre-flight Checks
- Validates server executable existence
- Checks for configuration files
- Verifies project structure

### 2. Process State Check
- Checks if server is already running
- Offers connection to existing instance
- Prevents multiple server instances

### 3. Configuration Loading
- Loads server configuration
- Validates config file format
- Applies custom settings

### 4. Server Launch
- Spawns server process
- Captures output streams
- Manages process lifecycle

### 5. State Management
- Tracks server process ID
- Monitors server status
- Handles graceful shutdown

## Examples

### Watch Mode Development (Recommended for Development)
```bash
$ tapi start --watch

🔄 Starting watch mode...
Press Ctrl+C to stop watching and exit

🔨 Building project...
✅ Build successful
🚀 Starting server...
✅ Server started in watch mode

[Real-time server output appears here...]
[10:30:00] Server plugins loaded.
[10:30:00] Started server on port: 7777

# Edit a .pwn file and save...
📝 File changed: gamemodes/myproject.pwn
🛑 Stopping server...
🔨 Building project...
✅ Build successful
🚀 Starting server...
✅ Server started in watch mode
```

### Basic Server Start (Inline Terminal - Default)
```bash
$ tapi start

=== Starting open.mp server... ===
→ Working directory: /path/to/project
→ Server executable: omp-server.exe
→ Config file: config.json
→ Gamemodes: myproject

Starting server in current terminal...
Press Ctrl+C to stop the server

→ Server started with PID: 12345

[Real-time server output appears here...]
[10:30:00] Server plugins loaded.
[10:30:00] Started server on port: 7777, with maxplayers: 50
[10:30:00] Gamemode 'myproject' loaded.

^C
→ Received SIGINT, stopping server...
Server stopped normally
```

### Legacy Window Mode
```bash
$ tapi start --window

=== Starting open.mp server... ===
→ Working directory: /path/to/project
→ Server executable: omp-server.exe
→ Config file: config.json

Starting server in a new window (legacy mode)...
Tip: Remove --window flag to run server inline with real-time output

Server started in a new window
Check your taskbar for the server window
```



### Custom Configuration
```bash
$ tapi start -c production.json

=== Starting open.mp server... ===
ℹ Working directory: /path/to/project
ℹ Server executable: omp-server.exe
ℹ Configuration: production.json

Starting server in the current terminal...
Press Ctrl+C to stop the server.
```

### Connect to Existing Server
```bash
$ tapi start --existing

✓ Connected to existing server instance
```

## Server Management

### Stopping the Server

#### Terminal Mode
- **Ctrl+C**: Gracefully stops the server
- **Automatic cleanup**: Clears server state and exits

#### Window Mode
- **Ctrl+C**: In the terminal that started the server
- **Manual**: Close the server window
- **tapi kill**: Emergency cleanup for stuck processes

### Emergency Cleanup

If you need to force-kill unresponsive server processes:

```bash
tapi kill [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation prompt |

#### Examples

```bash
# Interactive cleanup (with confirmation)
$ tapi kill

⚠️ This will forcefully terminate ALL SA-MP/open.mp server processes.
💡 For normal server shutdown, use Ctrl+C in the terminal running "tapi start"

Continue? (y/N): y

💀 Force killing server processes...
✅ Killed omp-server.exe
✅ Server processes terminated and state cleared

# Force cleanup (no confirmation)
$ tapi kill --force

💀 Force killing server processes...
✅ Server processes terminated and state cleared
```

### Server Status

The start command tracks server state including:
- **Process ID**: For process management
- **Start Time**: When the server was launched
- **Arguments**: Command line arguments used
- **Window Mode**: Whether running in separate window
- **Temp Files**: Temporary files to clean up

## Configuration Files

### config.json (Default)
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
  "plugins": [],
  "filterscripts": [],
  "pawn": {
    "main_scripts": ["gamemodes/my-gamemode"],
    "auto_reload": true
  }
}
```

### Custom Configuration
```json
{
  "hostname": "My Custom Server",
  "maxplayers": 100,
  "port": 7778,
  "rcon_password": "secure_password",
  "password": "server_password",
  "announce": false,
  "plugins": ["mysql", "sscanf"],
  "filterscripts": ["anticheat", "admin"],
  "pawn": {
    "main_scripts": ["gamemodes/custom-gamemode"],
    "auto_reload": false
  }
}
```

## Process Management

### Server State Tracking

The start command tracks server state using a state file:

```json
{
  "pid": 12345,
  "startTime": "2024-01-15T10:30:00.000Z",
  "config": "config.json",
  "workingDirectory": "/path/to/project",
  "arguments": ["--config=config.json"],
  "windowMode": false,
  "tempFiles": []
}
```

### Multiple Instance Prevention

When a server is already running:

```bash
$ tapi start

✗ Server is already running. Use Ctrl+C to stop it first.
ℹ Or use --existing flag to connect to the running server

$ tapi start --existing

✓ Connected to existing server instance
```

### Graceful Shutdown

When you press Ctrl+C in terminal mode:

```bash
Starting server in the current terminal...
Press Ctrl+C to stop the server.

^C
ℹ Received Ctrl+C, stopping server
✓ Server stopped successfully
```

## Error Handling

### Common Startup Errors

#### Server Executable Not Found
```bash
✗ Server executable not found. Make sure you are in the correct directory.

Expected server files:
• omp-server.exe (Windows)
• omp-server (Linux/macOS)

Run "tapi init" to set up a new project with server files
```

#### Configuration File Not Found
```bash
✗ Configuration file not found: custom-config.json
ℹ Available config files: config.json, production.json
```

#### Port Already in Use
```bash
✗ Failed to start server
  Error: Port 7777 is already in use
  Solution: Change port in config.json or stop conflicting server
```

#### Permission Issues
```bash
✗ Failed to start server
  Error: EACCES: permission denied
  Solution: Run as administrator or check file permissions
```

### Error Recovery

The start command provides:

1. **Clear error messages** with specific causes
2. **Helpful suggestions** for resolution
3. **Alternative options** when available
4. **State cleanup** on errors

## Platform-Specific Behavior

### Windows
- **Process Management**: Native Windows process handling
- **Window Mode**: Optional new window creation with proper PID tracking
- **VS Code Integration**: Automatic terminal detection
- **File Extensions**: Uses .exe executables

### Linux/macOS
- **Process Management**: Unix process handling
- **Terminal Mode**: Always runs in current terminal
- **Signal Handling**: Proper SIGTERM/SIGINT handling
- **File Extensions**: Uses binary executables

## Integration Features

### VS Code Integration

When VS Code is detected:

```bash
ℹ VS Code integration detected
ℹ Server will run in integrated terminal
ℹ Debug support available
```

### Development Workflow

1. **Start server**: `tapi start`
2. **Edit code**: Make changes in your editor
3. **Build code**: `tapi build` (or Ctrl+Shift+B in VS Code)
4. **Auto-reload**: Server automatically reloads changes (if enabled)
5. **Stop server**: Ctrl+C (normal) or `tapi kill` (emergency)

### Continuous Development

```bash
# Terminal 1: Start server
tapi start

# Terminal 2: Build and watch
tapi build --watch

# Terminal 3: Monitor logs
tail -f server.log

# Terminal 4: Emergency cleanup if needed
tapi kill
```

## Performance Considerations

### Resource Usage
- **Memory**: Server typically uses 50-200MB RAM
- **CPU**: Minimal when idle, scales with player count
- **Network**: Bandwidth depends on player activity

### Optimization Tips
- **Debug mode**: Disable in production for better performance
- **Logging**: Reduce log verbosity for better performance
- **Plugins**: Load only necessary plugins
- **Auto-reload**: Disable in production

## Troubleshooting

### Common Issues

#### "Server is already running"
**Cause**: Another server instance is active
**Solution**: Use Ctrl+C to stop the server

#### "Server executable not found"
**Cause**: Not in a project directory or server not installed
**Solution**: Run `tapi init` to set up project

#### "Port already in use"
**Cause**: Another service is using the port
**Solution**: Change port in config.json or stop conflicting service

#### "Permission denied"
**Cause**: Insufficient permissions
**Solution**: Run as administrator or check file permissions

#### "Configuration file not found"
**Cause**: Specified config file doesn't exist
**Solution**: Check file path or use default config.json

#### "Server won't stop"
**Cause**: Server process is unresponsive
**Solution**: Use Ctrl+C or `tapi kill` for emergency cleanup

### Getting Help

- **Verbose mode**: Use `--verbose` for detailed startup information
- **Debug mode**: Use `--debug` to see server debug output
- **Check logs**: Review server logs for specific errors
- **Validate config**: Ensure config.json is properly formatted
- **Emergency cleanup**: Use `tapi kill` for stuck processes

### Recovery Steps

1. **Stop all instances**: Use `tapi kill --force`
2. **Check configuration**: Validate config.json format
3. **Verify files**: Ensure server executable exists
4. **Try debug mode**: Use `--debug` for detailed error information
5. **Reinstall**: Run `tapi init` to reinstall server files

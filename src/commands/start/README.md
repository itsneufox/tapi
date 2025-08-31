# `start` Command

Start the open.mp server with intelligent process management, cross-platform support, and integrated development environment features.

## Overview

The `start` command launches the open.mp server with proper configuration, process management, and development-friendly features. It handles server state tracking, prevents multiple instances, and provides seamless integration with VS Code and other development tools.

## Usage

```bash
pawnctl start [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <file>` | Custom config file | config.json |

| `-e, --existing` | Connect to existing server | false |
| `-w, --window` | Force start in new window | false |
| `-v, --verbose` | Show detailed debug output | false |

## Features

### Process Management

- **State Tracking**: Monitors server running status
- **Instance Prevention**: Prevents multiple server instances
- **Graceful Shutdown**: Handles Ctrl+C and process termination
- **Crash Recovery**: Detects and reports server crashes

### Cross-Platform Support

- **Windows**: Native process management and window handling
- **Linux**: Terminal-based server management
- **macOS**: Unix-compatible process handling

### VS Code Integration

- **Automatic Window Management**: Detects VS Code usage and adjusts behavior
- **Integrated Terminal**: Server runs in VS Code's integrated terminal
- **Debug Support**: Compatible with VS Code debugging features

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

### Basic Server Start (Terminal Mode - Default)
```bash
$ pawnctl start

=== Starting open.mp server... ===
ℹ Working directory: /path/to/project
ℹ Server executable: omp-server.exe
ℹ Configuration: config.json

Starting server in the current terminal...
Press Ctrl+C to stop the server.

[Server output appears here...]
```

### Force New Window Mode
```bash
$ pawnctl start --window

=== Starting open.mp server... ===
ℹ Working directory: /path/to/project
ℹ Server executable: omp-server.exe
ℹ Configuration: config.json

Launching server in a new window...
✓ Server started in a new window
ℹ Check your taskbar for the server window
ℹ Use "pawnctl stop" to stop the server
```



### Custom Configuration
```bash
$ pawnctl start -c production.json

=== Starting open.mp server... ===
ℹ Working directory: /path/to/project
ℹ Server executable: omp-server.exe
ℹ Configuration: production.json

Starting server in the current terminal...
Press Ctrl+C to stop the server.
```

### Connect to Existing Server
```bash
$ pawnctl start --existing

✓ Connected to existing server instance
```

## Server Management

### Stopping the Server

#### Terminal Mode
- **Ctrl+C**: Gracefully stops the server
- **Automatic cleanup**: Clears server state and exits

#### Window Mode
- **pawnctl stop**: Stops the server from terminal
- **Manual**: Close the server window

### Stop Command

```bash
pawnctl stop [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Force stop the server (kill process) |

#### Examples

```bash
# Graceful stop
$ pawnctl stop

=== Stopping open.mp server... ===
✓ Stop signal sent to server
✓ Server stopped successfully

# Force stop
$ pawnctl stop --force

=== Stopping open.mp server... ===
✓ Stop signal sent to server
✓ Server stopped successfully
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
$ pawnctl start

✗ Server is already running. Use "pawnctl stop" to stop it first.
ℹ Or use --existing flag to connect to the running server

$ pawnctl start --existing

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

Run "pawnctl init" to set up a new project with server files
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
  Solution: Change port in config.json or stop other server
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

1. **Start server**: `pawnctl start`
2. **Edit code**: Make changes in your editor
3. **Build code**: `pawnctl build` (or Ctrl+Shift+B in VS Code)
4. **Auto-reload**: Server automatically reloads changes (if enabled)
5. **Stop server**: `pawnctl stop` or Ctrl+C (terminal mode)

### Continuous Development

```bash
# Terminal 1: Start server
pawnctl start

# Terminal 2: Build and watch
pawnctl build --watch

# Terminal 3: Monitor logs
tail -f server.log

# Terminal 4: Stop server when needed
pawnctl stop
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
**Solution**: Use `pawnctl stop` to stop the server

#### "Server executable not found"
**Cause**: Not in a project directory or server not installed
**Solution**: Run `pawnctl init` to set up project

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
**Cause**: Server running in window mode
**Solution**: Use `pawnctl stop` or `pawnctl stop --force`

### Getting Help

- **Verbose mode**: Use `--verbose` for detailed startup information
- **Debug mode**: Use `--debug` to see server debug output
- **Check logs**: Review server logs for specific errors
- **Validate config**: Ensure config.json is properly formatted
- **Stop command**: Use `pawnctl stop` to stop running servers

### Recovery Steps

1. **Stop all instances**: Use `pawnctl stop --force`
2. **Check configuration**: Validate config.json format
3. **Verify files**: Ensure server executable exists
4. **Try debug mode**: Use `--debug` for detailed error information
5. **Reinstall**: Run `pawnctl init` to reinstall server files

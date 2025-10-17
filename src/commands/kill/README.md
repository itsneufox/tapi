# `kill` Command

Force kill any running SA-MP/open.mp server processes for emergency cleanup.

## Overview

The `kill` command is designed for emergency situations where server processes become unresponsive or stuck. It forcefully terminates all SA-MP and open.mp server processes on the system and clears any stored server state.

**Note**: For normal server shutdown, use **Ctrl+C** in the terminal running `tapi start`.

## Usage

```bash
tapi kill [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --force` | Skip confirmation prompt | false |

## Examples

### Interactive Cleanup (Recommended)

```bash
$ tapi kill
ar
⚠️ This will forcefully terminate ALL SA-MP/open.mp server processes.
💡 For normal server shutdown, use Ctrl+C in the terminal running "tapi start"

Continue? (y/N): y

💀 Force killing server processes...
✅ Killed omp-server.exe
✅ Server processes terminated and state cleared
```

### Force Cleanup (No Confirmation)

```bash
$ tapi kill --force

💀 Force killing server processes...
✅ Killed omp-server.exe
✅ Killed samp-server.exe
✅ Server processes terminated and state cleared
```

### No Processes Found

```bash
$ tapi kill --force

💀 Force killing server processes...
ℹ️ No server processes found running
```

## What It Does

### Process Termination

The command searches for and terminates:

**Windows:**
- `omp-server.exe`
- `samp-server.exe` 
- `samp03svr.exe`

**Linux/macOS:**
- `omp-server`
- `samp-server`
- `samp03svr`

### State Cleanup

- Clears stored server state
- Removes PID tracking
- Cleans up temporary files
- Resets server status

## When to Use

### Emergency Situations

- Server process becomes unresponsive
- Ctrl+C doesn't work in the start terminal
- Server process is stuck or crashed
- Multiple orphaned server processes
- Terminal was closed unexpectedly

### NOT for Normal Use

- ❌ Regular server shutdown (use Ctrl+C instead)
- ❌ Switching between projects (use Ctrl+C + start)
- ❌ Restarting for configuration changes

## Platform Behavior

### Windows
Uses `taskkill /F /IM <process> /T` to:
- Force terminate processes (`/F`)
- Kill by image name (`/IM`)
- Kill process tree (`/T`)

### Linux/macOS  
Uses `pkill -f <pattern>` to:
- Find processes by pattern (`-f`)
- Send SIGTERM signal
- Clean process termination

## Safety Features

### Confirmation Prompt
- Warns about forceful termination
- Shows alternative (Ctrl+C) for normal shutdown
- Requires explicit confirmation

### Targeted Termination
- Only kills SA-MP/open.mp server processes
- Doesn't affect other applications
- Safe for system stability

## Troubleshooting

### Permission Issues
```bash
❌ Kill operation failed: Access denied
```
**Solution**: Run terminal as administrator (Windows) or use sudo (Linux/macOS)

### Process Still Running
```bash
⚠️ Could not kill omp-server.exe: Process not found
```
**Cause**: Process may have already terminated or different name
**Solution**: Check Task Manager/Activity Monitor manually

### No Processes Found
```bash
ℹ️ No server processes found running
```
**Cause**: No SA-MP/open.mp servers are currently running
**Solution**: This is normal - no action needed

## Best Practices

1. **Try Ctrl+C first**: Always attempt graceful shutdown before using kill
2. **Use confirmation**: Don't use `--force` unless necessary
3. **Check processes**: Verify what processes are running before killing
4. **Clean slate**: Use after crashes to ensure clean restart

## Related Commands

- `tapi start` - Start server with graceful shutdown support
- Process managers (Task Manager, Activity Monitor, htop) - Manual process inspection

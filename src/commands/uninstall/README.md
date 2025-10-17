# `uninstall` Command

Remove tapi and clean up all user data including configuration files, logs, and cache.

## Overview

The `uninstall` command provides a clean way to remove all tapi user data from the system. This includes configuration files, log files, and any cached data stored in the user's home directory.

## Usage

```bash
tapi uninstall [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --force` | Skip confirmation prompt | false |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --verbose` | Show detailed debug output | false |
| `-q, --quiet` | Minimize console output (show only progress bars) | false |
| `--log-to-file` | Save logs to file for debugging | false |

## What Gets Removed

The uninstall command removes the entire `.tapi` directory from the user's home directory, which includes:

- **Configuration files**: User preferences, editor settings, GitHub tokens
- **Log files**: All tapi log files including latest.log and timestamped logs
- **Cache data**: Any temporary data or cached files
- **State files**: Server state and other runtime data

### File Locations

#### Windows
```
C:\Users\<username>\.tapi\
├── config.json          # User configuration
├── logs\                 # Log files directory
│   ├── latest.log       # Latest log file
│   └── tapi-*.log    # Timestamped log files
└── [other cache files]
```

#### Linux/macOS
```
~/.tapi/
├── config.json          # User configuration
├── logs/                 # Log files directory
│   ├── latest.log       # Latest log file
│   └── tapi-*.log    # Timestamped log files
└── [other cache files]
```

## Examples

### Interactive Uninstall
```bash
$ tapi uninstall

Tapi Uninstaller

This will remove ALL tapi user data including:
   - Configuration files
   - Log files
   - Cache data
   - The entire ~/.tapi directory

? Are you sure you want to continue? (y/N) y

Removing user data...
User data removed successfully
Removed directory: /home/user/.tapi

Tapi uninstall completed
You can safely remove the tapi executable now
```

### Force Uninstall (No Confirmation)
```bash
$ tapi uninstall --force

Tapi Uninstaller

This will remove ALL tapi user data including:
   - Configuration files
   - Log files
   - Cache data
   - The entire ~/.tapi directory

Removing user data...
User data removed successfully
Removed directory: /home/user/.tapi

Tapi uninstall completed
You can safely remove the tapi executable now
```

### No User Data Found
```bash
$ tapi uninstall

Tapi Uninstaller

This will remove ALL tapi user data including:
   - Configuration files
   - Log files
   - Cache data
   - The entire ~/.tapi directory

? Are you sure you want to continue? (y/N) y

No user data found to remove
Uninstall completed
```

## Use Cases

### Clean Reinstallation
When you need to completely reset tapi to its default state:

```bash
# Remove all user data
tapi uninstall --force

# Reinstall or reconfigure
tapi setup
```

### Troubleshooting
When experiencing configuration issues:

```bash
# Remove corrupted configuration
tapi uninstall --force

# Start fresh
tapi setup
```

### System Cleanup
Before removing tapi from the system:

```bash
# Clean up user data first
tapi uninstall

# Then remove the executable manually or use system uninstaller
```

## Integration with System Installers

### Windows Installer
The Windows Inno Setup installer automatically calls the uninstall command during uninstallation:

```bash
# Called automatically by Windows uninstaller
tapi uninstall --force
```

### Manual Installation
For manually installed tapi:

1. Run the uninstall command: `tapi uninstall`
2. Remove the tapi executable
3. Remove from PATH if manually added

## Safety Features

### Confirmation Prompt
By default, the command asks for confirmation before removing data:

- Shows exactly what will be removed
- Requires explicit confirmation (y/N)
- Defaults to "No" for safety

### Force Mode
The `--force` flag skips confirmation:

- Useful for automated scripts
- Used by system uninstallers
- Should be used carefully

### Error Handling
The command handles various error conditions:

- **Permission denied**: Clear error message about file permissions
- **Directory not found**: Gracefully handles missing user data
- **Partial removal**: Reports what was successfully removed

## Security Considerations

### Data Privacy
The uninstall command ensures complete data removal:

- Removes all configuration files (including tokens)
- Clears all log files (may contain sensitive information)
- Removes any cached data

### File Permissions
The command respects file system permissions:

- Only removes files owned by the current user
- Fails gracefully if permissions are insufficient
- Provides clear error messages

## Troubleshooting

### Common Issues

#### "Permission denied"
**Cause**: Insufficient permissions to remove files
**Solution**: 
- Windows: Run as Administrator
- Linux/macOS: Check file ownership and permissions

#### "Directory not found"
**Cause**: No tapi user data exists
**Result**: Command completes successfully (nothing to remove)

#### "Failed to remove some files"
**Cause**: Files may be in use or have special permissions
**Solution**: 
1. Close any running tapi processes
2. Check file permissions
3. Try running with elevated privileges

### Recovery

If the uninstall command fails partway through:

1. **Check what remains**: Look for remaining files in `~/.tapi`
2. **Manual cleanup**: Remove remaining files manually
3. **Re-run command**: Try running `tapi uninstall --force` again

### Verification

To verify complete removal:

```bash
# Check if directory exists (should not exist after uninstall)
ls ~/.tapi  # Linux/macOS
dir "%USERPROFILE%\.tapi"  # Windows
```

## Related Commands

- `tapi setup` - Initial configuration after uninstall
- `tapi config` - View current configuration before uninstall
- `tapi kill` - Emergency cleanup of running processes

## Notes

- The uninstall command only removes user data, not the tapi executable itself
- Project files created with `tapi init` are not affected
- The command is safe to run multiple times
- Use `--force` in automated scripts to skip confirmation

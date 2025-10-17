# `update` Command

Check for and install tapi updates automatically from GitHub releases.

## Overview

The `update` command provides an automated way to keep tapi up-to-date by checking GitHub releases and downloading the latest version. It supports both manual updates and automatic checking.

## Usage

```bash
tapi update [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --check` | Only check for updates, do not install | false |
| `-f, --force` | Force update even if already on latest version | false |
| `--pre` | Include pre-release versions | false |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --verbose` | Show detailed debug output | false |
| `-q, --quiet` | Minimize console output (show only progress bars) | false |
| `--log-to-file` | Save logs to file for debugging | false |

## Features

### Automatic Update Detection
- Checks GitHub releases for new versions
- Compares semantic versions intelligently
- Caches update checks (once per 24 hours)
- Shows release notes and changelog

### Cross-Platform Support
- **Windows**: Downloads and runs the latest installer
- **Linux**: Downloads and replaces the binary
- **macOS**: Downloads and replaces the binary

### Safe Update Process
- Creates backup before updating (Linux/macOS)
- Validates downloads before installation
- Rollback on failure
- Permission handling

### Update Notifications
- Automatic background checks on startup
- Non-intrusive notifications
- Respects user preferences

## Examples

### Check for Updates
```bash
$ tapi update --check

Checking for tapi updates...
Current version: 1.0.0-alpha.1
Latest version: 1.0.1

New version available: 1.0.1
Release name: Bug Fixes and Improvements
Changes:
- Fixed installer version check issue
- Added auto-update functionality
- Improved error handling

Use "tapi update" to install the update
```

### Install Update
```bash
$ tapi update

Checking for tapi updates...
Current version: 1.0.0-alpha.1
Latest version: 1.0.1

New version available: 1.0.1
Release name: Bug Fixes and Improvements
Changes:
- Fixed installer version check issue
- Added auto-update functionality
- Improved error handling

? Update to version 1.0.1? (Y/n) y

Downloading tapi-setup-1.0.1.exe...
Starting installer...
The installer will now run. This terminal will close.
```

### Force Update
```bash
$ tapi update --force

Checking for tapi updates...
Current version: 1.0.1
Latest version: 1.0.1

New version available: 1.0.1 (forced)
Release name: Bug Fixes and Improvements

? Update to version 1.0.1? (Y/n) y

Downloading tapi-setup-1.0.1.exe...
Starting installer...
```

### Include Pre-releases
```bash
$ tapi update --pre --check

Checking for tapi updates...
Current version: 1.0.0
Latest version: 1.1.0-beta.1

New version available: 1.1.0-beta.1
Release name: Beta Testing Release
Changes:
- New experimental features
- Performance improvements
- Breaking changes (see migration guide)

Use "tapi update --pre" to install the pre-release
```

### Already Up to Date
```bash
$ tapi update

Checking for tapi updates...
Current version: 1.0.1
Latest version: 1.0.1

You are already on the latest version (1.0.1)
```

## Automatic Update Checking

### Background Checks
tapi automatically checks for updates in the background when:
- Running any command (except `--help` and `--version`)
- Not during first setup
- Once every 24 hours (cached)

### Update Notifications
When a new version is available:

```bash
$ tapi build

🎉 A new version of tapi is available: 1.0.1
Run "tapi update" to upgrade

=== Building PAWN project... ===
...
```

### Privacy
- Update checks are anonymous
- No telemetry or usage data collected
- Only version comparison data sent

## Platform-Specific Behavior

### Windows
- Downloads the latest `.exe` installer
- Runs installer automatically
- Current process exits to allow installation
- Requires admin privileges for installation

### Linux/macOS
- Downloads the latest binary
- Creates backup of current binary
- Replaces binary in-place
- Makes new binary executable
- Restores backup on failure

## Update Process Flow

### 1. Version Check
- Fetches latest release from GitHub API
- Compares semantic versions
- Filters drafts and pre-releases (unless `--pre`)

### 2. User Confirmation
- Shows release information
- Displays changelog/release notes
- Prompts for confirmation (unless scripted)

### 3. Download
- Downloads appropriate asset for platform
- Validates file integrity
- Handles redirects and GitHub CDN

### 4. Installation
- **Windows**: Launches installer and exits
- **Unix**: Backs up, replaces, and validates binary

### 5. Cleanup
- Removes temporary files
- Updates cache
- Reports success/failure

## Error Handling

### Common Issues

#### Network Connectivity
```bash
Failed to update tapi
Error: Request timeout
```
**Solution**: Check internet connection and try again

#### GitHub API Rate Limits
```bash
Failed to check for updates: GitHub API returned 403
```
**Solution**: Wait an hour and try again (rate limits reset)

#### Permission Denied
```bash
Failed to update tapi
Error: EACCES: permission denied
```
**Solution**: 
- Windows: Run as Administrator
- Linux/macOS: Use `sudo` or check file permissions

#### No Installer Available
```bash
Failed to update tapi
Error: No installer found for linux
```
**Solution**: Platform not supported or release incomplete

#### Download Failure
```bash
Failed to update tapi
Error: Download failed: 404
```
**Solution**: Release assets may be missing, try again later

### Recovery

If an update fails:

1. **Check error message** for specific issue
2. **Verify internet connection**
3. **Try with `--force` flag**
4. **Manual installation** as fallback
5. **Report issue** if persistent

## Configuration

### Cache Location
Update check cache is stored at:
- **Windows**: `%USERPROFILE%\.tapi\update-cache.json`
- **Linux/macOS**: `~/.tapi/update-cache.json`

### Cache Structure
```json
{
  "lastCheck": "2024-01-15T10:30:00.000Z",
  "hasUpdate": true,
  "latestVersion": "1.0.1",
  "currentVersion": "1.0.0"
}
```

### Manual Cache Reset
```bash
# Windows
del "%USERPROFILE%\.tapi\update-cache.json"

# Linux/macOS  
rm ~/.tapi/update-cache.json
```

## Integration with CI/CD

### Automated Updates
```bash
# Check for updates without installing
tapi update --check

# Force update in CI environment
echo "y" | tapi update --force
```

### Version Pinning
For stable CI environments, pin to specific versions rather than using auto-update.

## Security Considerations

### Secure Downloads
- Downloads from official GitHub releases only
- Validates GitHub API responses
- Uses HTTPS for all connections
- Verifies file integrity where possible

### Update Authenticity
- Updates come from official repository
- GitHub provides cryptographic signatures
- No third-party update servers

### Permissions
- Requires appropriate permissions for installation
- Creates backups before modification
- Fails safely on permission errors

## Related Commands

- `tapi --version` - Show current version
- `tapi config` - View configuration settings
- `tapi setup` - Reconfigure after updates

## Notes

- Update checks respect GitHub API rate limits
- Pre-releases are excluded from automatic checks
- Updates preserve user configuration and data
- Internet connection required for update checks

# Pawnctl Installer

This directory contains scripts and configuration for building Windows installers for pawnctl.

## Building the Installer

### Prerequisites

1. **Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Inno Setup** (Windows only):
   - Download from: https://jrsoftware.org/isinfo.php
   - Install with default settings
   - Make sure `iscc.exe` is in your PATH

### Building Process

1. **Build executable**:
   ```bash
   npm run build:executable
   ```
   This creates:
   - `binaries/pawnctl-win.exe` (Windows)
   - `binaries/pawnctl-linux` (Linux)
   - `binaries/pawnctl-macos` (macOS)

2. **Create Windows installer**:
   ```bash
   npm run build:installer
   # Then run the displayed command:
   iscc installer/pawnctl-setup.iss
   ```

3. **Result**:
   - Windows installer: `dist-installer/pawnctl-setup-1.0.0-alpha.1.exe`

## Installer Features

### What gets installed:
- Main executable (`pawnctl.exe`) to Program Files
- Required templates and dependencies
- PATH environment variable integration
- Desktop shortcuts (optional)

### User Data Management:
- Configuration stored in: `%USERPROFILE%\.pawnctl\`
- Logs stored in: `%USERPROFILE%\.pawnctl\logs\`
- Complete cleanup on uninstall

### Uninstaller Features:
- Removes all program files
- Cleans up user data directory
- Removes PATH entries
- Built-in confirmation dialogs

## Testing

1. **Test on clean VM**: Always test installers on a clean Windows system
2. **Test both install and uninstall**
3. **Verify PATH integration**: `pawnctl --version` should work from any directory
4. **Check user data cleanup**: Ensure `%USERPROFILE%\.pawnctl\` is removed after uninstall

## Distribution

The resulting installer can be distributed via:
- GitHub Releases
- Direct download links
- Package repositories
- Internal distribution systems

## File Structure

```
installer/
├── README.md                 # This file
├── build-executable.js       # Builds cross-platform executables
├── create-distribution.js    # Creates alpha testing packages
├── pawnctl-setup.iss        # Inno Setup script (main Windows installer)
├── install-windows.ps1      # Alternative PowerShell installer
├── install.bat              # Batch wrapper for PowerShell installer
└── uninstall.bat            # Manual uninstaller for PowerShell method
```

## Cross-Platform Support

While the Inno Setup installer is Windows-only, the `build-executable.js` script creates binaries for:
- Windows (.exe)
- Linux (binary)
- macOS (binary)

For Linux/macOS distribution, consider:
- Creating .deb/.rpm packages
- Homebrew formulas
- Snap packages
- AppImage (Linux)

## Troubleshooting

### Common Issues:

1. **"iscc not found"**: Install Inno Setup and add to PATH
2. **"pkg not found"**: Run `npm install` to install dependencies
3. **Build fails**: Ensure `npm run build` works first
4. **Icon not found**: Comment out IconFile line in .iss file

### Debug Mode:
Add `/DDEBUG` flag to iscc command for verbose output:
```bash
iscc /DDEBUG installer/pawnctl-setup.iss
```

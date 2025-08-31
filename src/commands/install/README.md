# `install` Command

Install packages from GitHub repositories with dependency management and cross-platform support.

## Overview

The `install` command downloads and installs PAWN packages from GitHub repositories. It supports various repository references (branches, tags, commits), handles dependencies, and provides cross-platform compatibility for different operating systems.

## Usage

```bash
pawnctl install <repository> [options]
```

## Repository Format

```
owner/repository[@branch|@tag|@commit]
```

### Examples
- `openmultiplayer/omp-stdlib` - Latest default branch
- `owner/repo@develop` - Specific branch
- `owner/repo@v1.0.0` - Specific tag
- `owner/repo@abc1234` - Specific commit

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dependencies` | Install dependencies recursively | false |
| `-v, --verbose` | Show detailed debug output | false |

## Features

### GitHub Integration
- **Direct Repository Access**: Install packages directly from GitHub
- **Authentication Support**: Use GitHub token for private repositories
- **Rate Limit Management**: Respects GitHub API rate limits
- **Repository Validation**: Checks for valid repository structure

### Version Control Support
- **Branch References**: Install from specific branches
- **Tag References**: Install from specific version tags
- **Commit References**: Install from specific commits
- **Default Branch**: Uses repository's default branch when no reference specified

### Dependency Management
- **Recursive Installation**: Install package dependencies automatically
- **Dependency Resolution**: Handles complex dependency chains
- **Conflict Detection**: Identifies and reports dependency conflicts
- **Circular Dependency Prevention**: Prevents infinite dependency loops

### Cross-Platform Support
- **Windows**: Native Windows file handling
- **Linux**: Unix-compatible file operations
- **macOS**: macOS-specific optimizations
- **Platform Detection**: Automatic platform-specific file selection

### Package Validation
- **pawn.json Validation**: Ensures package has proper manifest
- **Structure Validation**: Verifies correct package structure
- **File Integrity**: Validates downloaded files
- **Compatibility Check**: Ensures package compatibility

## Installation Process

### 1. Repository Parsing
- Parses repository URL and reference
- Validates repository format
- Determines installation target

### 2. Repository Information Fetching
- Fetches repository metadata from GitHub
- Validates repository existence and access
- Retrieves pawn.json manifest information

### 3. Package Validation
- Validates pawn.json structure
- Checks for required fields
- Verifies package compatibility

### 4. File Download and Installation
- Downloads package files
- Extracts and installs to appropriate directories
- Handles platform-specific file selection

### 5. Dependency Resolution
- Identifies package dependencies
- Recursively installs dependencies
- Resolves dependency conflicts

## Examples

### Basic Package Installation
```bash
$ pawnctl install openmultiplayer/omp-stdlib

=== Installing package: openmultiplayer/omp-stdlib ===
ℹ Repository: https://github.com/openmultiplayer/omp-stdlib
ℹ Reference: main (default branch)
ℹ Platform: windows

Fetching repository information...
✓ Repository information fetched successfully

Package details:
• Name: omp-stdlib
• Version: 1.0.0
• Description: open.mp Standard Library
• Dependencies: None

Downloading package files...
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 245/245 KB

Installing package...
✓ Package installed successfully
  Location: includes/omp-stdlib/
  Files: 15 files installed
```

### Install Specific Version
```bash
$ pawnctl install openmultiplayer/omp-stdlib@v1.2.0

=== Installing package: openmultiplayer/omp-stdlib@v1.2.0 ===
ℹ Repository: https://github.com/openmultiplayer/omp-stdlib
ℹ Reference: v1.2.0 (tag)
ℹ Platform: windows

Fetching repository information...
✓ Repository information fetched successfully

Package details:
• Name: omp-stdlib
• Version: 1.2.0
• Description: open.mp Standard Library v1.2.0
• Dependencies: None

Downloading package files...
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 248/248 KB

Installing package...
✓ Package installed successfully
  Location: includes/omp-stdlib/
  Files: 16 files installed
```

### Install with Dependencies
```bash
$ pawnctl install owner/advanced-gamemode --dependencies

=== Installing package: owner/advanced-gamemode ===
ℹ Repository: https://github.com/owner/advanced-gamemode
ℹ Reference: main (default branch)
ℹ Platform: windows
ℹ Dependencies: enabled

Fetching repository information...
✓ Repository information fetched successfully

Package details:
• Name: advanced-gamemode
• Version: 2.1.0
• Description: Advanced gamemode with features
• Dependencies: mysql, sscanf, streamer

Installing dependencies...
=== Installing dependency: mysql ===
✓ mysql installed successfully

=== Installing dependency: sscanf ===
✓ sscanf installed successfully

=== Installing dependency: streamer ===
✓ streamer installed successfully

Downloading package files...
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 1024/1024 KB

Installing package...
✓ Package installed successfully
  Location: gamemodes/advanced-gamemode/
  Files: 25 files installed
  Dependencies: 3 packages installed
```

### Install from Specific Branch
```bash
$ pawnctl install owner/experimental-feature@develop

=== Installing package: owner/experimental-feature@develop ===
ℹ Repository: https://github.com/owner/experimental-feature
ℹ Reference: develop (branch)
ℹ Platform: windows

Fetching repository information...
✓ Repository information fetched successfully

Package details:
• Name: experimental-feature
• Version: 0.5.0-dev
• Description: Experimental features (development version)
• Dependencies: None

Downloading package files...
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 156/156 KB

Installing package...
✓ Package installed successfully
  Location: includes/experimental-feature/
  Files: 8 files installed
```

### Verbose Installation
```bash
$ pawnctl install openmultiplayer/omp-stdlib --verbose

=== Installing package: openmultiplayer/omp-stdlib ===
ℹ Repository: https://github.com/openmultiplayer/omp-stdlib
ℹ Reference: main (default branch)
ℹ Platform: windows
ℹ GitHub API: Using authenticated requests

Fetching repository information...
ℹ API endpoint: https://api.github.com/repos/openmultiplayer/omp-stdlib
ℹ Rate limit: 5000/5000 remaining
✓ Repository information fetched successfully

Package details:
• Name: omp-stdlib
• Version: 1.0.0
• Description: open.mp Standard Library
• Dependencies: None
• Include path: includes/
• Files: 15 files

Downloading package files...
ℹ Download URL: https://github.com/openmultiplayer/omp-stdlib/archive/main.zip
ℹ File size: 245 KB
Downloading [████████████████████████████████████████] 100% | ETA: 0s | 245/245 KB

Installing package...
ℹ Extracting archive...
ℹ Creating directory: includes/omp-stdlib/
ℹ Copying files...
  ✓ omp-stdlib.inc
  ✓ omp-stdlib-core.inc
  ✓ omp-stdlib-utils.inc
  ✓ README.md
  ✓ LICENSE
✓ Package installed successfully
  Location: includes/omp-stdlib/
  Files: 15 files installed
```

## Package Structure

### Required Files
```
package-name/
├── pawn.json              # Package manifest (required)
├── README.md              # Package documentation
├── LICENSE                # License information
└── [package files]        # Actual package files
```

### pawn.json Manifest
```json
{
  "name": "package-name",
  "version": "1.0.0",
  "description": "Package description",
  "author": "Author Name",
  "license": "MIT",
  "repository": "owner/repository",
  "include_path": "includes/",
  "dependencies": [
    "dependency1",
    "dependency2"
  ],
  "files": [
    "package.inc",
    "README.md",
    "LICENSE"
  ]
}
```

## Dependency Management

### Dependency Resolution
1. **Parse Dependencies**: Extract dependencies from pawn.json
2. **Check Conflicts**: Identify version conflicts
3. **Install Dependencies**: Recursively install required packages
4. **Validate Installation**: Ensure all dependencies are properly installed

### Dependency Conflicts
```bash
=== Installing package: owner/conflicting-package ===
⚠️  Dependency conflict detected:
   Required: mysql@v2.0.0
   Installed: mysql@v1.5.0
   
   Resolution: Installing mysql@v2.0.0 (upgrade)
```

### Circular Dependencies
```bash
=== Installing package: owner/circular-package ===
✗ Circular dependency detected:
   package-a → package-b → package-c → package-a
   
   Solution: Review dependency chain and remove circular reference
```

## Platform Support

### Windows
- **File Extensions**: .exe, .dll, .inc
- **Path Separators**: Backslashes (\)
- **Archive Formats**: .zip, .tar.gz

### Linux
- **File Extensions**: Binary files, .inc
- **Path Separators**: Forward slashes (/)
- **Archive Formats**: .tar.gz, .zip

### macOS
- **File Extensions**: Binary files, .inc
- **Path Separators**: Forward slashes (/)
- **Archive Formats**: .tar.gz, .zip

## Error Handling

### Common Installation Errors

#### Repository Not Found
```bash
✗ Repository not found: owner/nonexistent-repo
  Error: 404 Not Found
  Solution: Check repository name and access permissions
```

#### Invalid Reference
```bash
✗ Invalid reference: v999.999.999
  Error: Tag not found
  Solution: Check available tags or use valid reference
```

#### Network Issues
```bash
✗ Failed to download package
  Error: Network timeout
  Solution: Check internet connection and try again
```

#### Permission Issues
```bash
✗ Failed to install package
  Error: EACCES: permission denied
  Solution: Check directory permissions or run as administrator
```

#### Dependency Conflicts
```bash
✗ Dependency conflict: mysql@v2.0.0 conflicts with mysql@v1.5.0
  Error: Version mismatch
  Solution: Resolve version conflicts or use compatible versions
```

### Error Recovery

The install command provides:

1. **Clear error messages** with specific causes
2. **Helpful suggestions** for resolution
3. **Partial cleanup** on installation failures
4. **Retry mechanisms** for transient errors

## GitHub Integration

### Authentication
- **Personal Access Token**: Use GitHub token for private repositories
- **Rate Limits**: Increased limits for authenticated requests
- **Private Access**: Access to private repositories with proper permissions

### Token Configuration
```bash
# Configure GitHub token
pawnctl config
# Select "GitHub integration" → "Update the token"
```

### Rate Limit Management
```bash
ℹ GitHub API rate limit: 4500/5000 remaining
ℹ Rate limit resets in: 45 minutes
```

## Best Practices

### Package Installation
1. **Use Specific Versions**: Install from tags for stability
2. **Check Dependencies**: Review package dependencies before installation
3. **Validate Packages**: Ensure packages have proper pawn.json manifests
4. **Backup Projects**: Backup projects before installing packages

### Dependency Management
1. **Minimize Dependencies**: Only install necessary packages
2. **Version Pinning**: Use specific versions for critical dependencies
3. **Regular Updates**: Keep packages updated for security and features
4. **Conflict Resolution**: Resolve dependency conflicts promptly

### Security Considerations
1. **Source Verification**: Install from trusted repositories
2. **Token Security**: Keep GitHub tokens secure and private
3. **Package Validation**: Review package contents before installation
4. **Access Control**: Use minimal required permissions for tokens

## Troubleshooting

### Common Issues

#### "Repository not found"
**Cause**: Invalid repository name or insufficient permissions
**Solution**: Check repository name and GitHub token configuration

#### "Invalid reference"
**Cause**: Branch, tag, or commit doesn't exist
**Solution**: Check available references in the repository

#### "Network timeout"
**Cause**: Slow internet connection or GitHub API issues
**Solution**: Check internet connection and try again later

#### "Permission denied"
**Cause**: Insufficient file system permissions
**Solution**: Check directory permissions or run as administrator

#### "Dependency conflict"
**Cause**: Incompatible package versions
**Solution**: Resolve version conflicts or use compatible versions

### Getting Help

- **Verbose mode**: Use `--verbose` for detailed installation information
- **Check repository**: Verify repository exists and is accessible
- **Validate token**: Ensure GitHub token has proper permissions
- **Review dependencies**: Check package dependencies and conflicts

### Recovery Steps

1. **Check repository**: Verify repository name and access
2. **Validate reference**: Check available branches, tags, and commits
3. **Configure token**: Set up GitHub token for private repositories
4. **Resolve conflicts**: Address dependency conflicts
5. **Retry installation**: Attempt installation again

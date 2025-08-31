# `config` Command

Manage pawnctl user preferences and settings through an interactive configuration interface.

## Overview

The `config` command provides an interactive way to manage pawnctl user preferences, including default author information, preferred editor settings, GitHub integration, and other configuration options. It offers a user-friendly interface for viewing and modifying settings without manually editing configuration files.

## Usage

```bash
pawnctl config [options]
```

## Features

### Interactive Configuration Management

- **Current Settings Display**: View all current configuration values
- **Individual Setting Updates**: Modify specific settings one at a time
- **GitHub Integration**: Configure GitHub token for package installation
- **Editor Preferences**: Set preferred code editor for project setup
- **Default Author**: Configure default author name for new projects

### Configuration Categories

1. **User Information**: Default author name for projects
2. **Editor Preferences**: Preferred code editor (VS Code, Sublime Text, etc.)
3. **GitHub Integration**: Personal access token for package installation
4. **System Settings**: Setup completion status and other system preferences

### Persistent Storage

- **Automatic Saving**: Changes are saved immediately
- **Cross-Session Persistence**: Settings persist between command sessions
- **Backup Support**: Configuration can be reset to defaults
- **Validation**: Input validation and error handling

## Configuration Options

### Default Author
Set your name to be used as the default author for new projects.

**Location**: `~/.pawnctl/preferences.json`
**Key**: `defaultAuthor`
**Example**: `"Developer Name"`

### Preferred Editor
Choose your preferred code editor for project setup and integration.

**Options**:
- **VS Code**: Full integration with tasks, debugging, and IntelliSense
- **Sublime Text**: Basic configuration and syntax highlighting
- **Other/None**: No editor-specific setup

**Location**: `~/.pawnctl/preferences.json`
**Key**: `editor`
**Example**: `"VS Code"`

### GitHub Integration
Configure GitHub personal access token for package installation.

**Purpose**: Enables installation of packages from private repositories and increases API rate limits
**Location**: `~/.pawnctl/preferences.json`
**Key**: `githubToken`
**Example**: `"ghp_xxxxxxxxxxxxxxxxxxxx"`

### Setup Status
Track whether initial setup has been completed.

**Location**: `~/.pawnctl/preferences.json`
**Key**: `setupComplete`
**Example**: `true`

## Examples

### View Current Configuration
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

### Configure GitHub Integration
```bash
$ pawnctl config

Current pawnctl configuration:
• Default author: Developer
• Preferred editor: VS Code
• GitHub integration: Not configured
• Setup complete: Yes

What would you like to configure?
✔ Select an option › GitHub integration
✔ Enter your GitHub personal access token: ****************
✓ GitHub token configured successfully
```

### Update Editor Preference
```bash
$ pawnctl config

Current pawnctl configuration:
• Default author: Developer
• Preferred editor: Sublime Text
• GitHub integration: Configured
• Setup complete: Yes

What would you like to configure?
✔ Select an option › Preferred editor
✔ Which code editor do you use most for PAWN development? VS Code
✓ Preferred editor updated to: VS Code
```

### Reset Configuration
```bash
$ pawnctl config

Current pawnctl configuration:
• Default author: Developer
• Preferred editor: VS Code
• GitHub integration: Configured
• Setup complete: Yes

What would you like to configure?
✔ Select an option › Reset all configuration
⚠️  This will reset ALL configuration to defaults. Type "confirm" to proceed: confirm
✓ Configuration reset to defaults
```

## Configuration File Structure

### preferences.json
```json
{
  "defaultAuthor": "Developer Name",
  "editor": "VS Code",
  "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "setupComplete": true
}
```

### File Locations

#### Windows
```
C:\Users\<username>\.pawnctl\preferences.json
```

#### Linux/macOS
```
~/.pawnctl/preferences.json
```

## Interactive Menu Options

### Main Menu
```
Current pawnctl configuration:
• Default author: Developer
• Preferred editor: VS Code
• GitHub integration: Configured
• Setup complete: Yes

What would you like to configure?
✔ Select an option › [Use arrow keys to navigate]
  • Default author
  • Preferred editor
  • GitHub integration
  • Reset all configuration
  • Exit
```

### GitHub Integration Submenu
```
GitHub token is already configured. What would you like to do?
✔ Select an option › [Use arrow keys to navigate]
  • Update the token
  • Remove the token
  • Keep current token
```

### Editor Selection
```
Which code editor do you use most for PAWN development?
✔ Select an option › [Use arrow keys to navigate]
  • Visual Studio Code (recommended)
  • Sublime Text
  • Other/None
```

## Configuration Impact

### Default Author
- **Used in**: `pawnctl init` command
- **Affects**: Project manifest (pawn.json) author field
- **Default**: Empty (prompts user during init)

### Preferred Editor
- **Used in**: `pawnctl init` command
- **Affects**: Editor-specific file generation (.vscode/, etc.)
- **Default**: VS Code

### GitHub Integration
- **Used in**: `pawnctl install` command
- **Affects**: Package installation from GitHub repositories
- **Default**: Not configured

### Setup Status
- **Used in**: `pawnctl setup` command
- **Affects**: Whether setup wizard runs automatically
- **Default**: false

## Security Considerations

### GitHub Token Storage
- **Location**: Local configuration file
- **Permissions**: User read/write only
- **Scope**: Minimal required permissions
- **Security**: Store securely, don't share

### Token Permissions
Recommended GitHub token permissions:
- **repo**: Access to private repositories
- **read:packages**: Download packages
- **No admin permissions**: Minimal scope for security

### Token Management
```bash
# View current token status
pawnctl config

# Update token
pawnctl config
# Select "GitHub integration" → "Update the token"

# Remove token
pawnctl config
# Select "GitHub integration" → "Remove the token"
```

## Error Handling

### Common Issues

#### Configuration File Corruption
```bash
✗ Failed to load configuration
  Error: Invalid JSON format
  Solution: Configuration file will be reset to defaults
```

#### Permission Issues
```bash
✗ Failed to save configuration
  Error: EACCES: permission denied
  Solution: Check file permissions or run as administrator
```

#### Invalid Input
```bash
✗ Invalid input provided
  Error: Author name cannot be empty
  Solution: Provide a valid author name
```

### Recovery Options

1. **Reset Configuration**: Use "Reset all configuration" option
2. **Manual Edit**: Edit preferences.json file directly
3. **Delete File**: Remove preferences.json to start fresh
4. **Re-run Setup**: Use `pawnctl setup --force`

## Integration with Other Commands

### init Command
- **Default Author**: Pre-fills author field in interactive prompts
- **Editor Preference**: Determines which editor files to generate
- **Setup Status**: Affects whether setup wizard runs

### install Command
- **GitHub Token**: Used for package installation from GitHub
- **Rate Limits**: Increases API rate limits for authenticated requests
- **Private Repos**: Enables access to private repositories

### setup Command
- **Setup Status**: Tracks whether initial setup is complete
- **Configuration**: Uses current settings as defaults

## Best Practices

### Configuration Management
1. **Set Default Author**: Configure your name for convenience
2. **Choose Editor**: Select your preferred editor for integration
3. **Configure GitHub**: Set up token for package installation
4. **Regular Updates**: Review and update settings periodically

### Security
1. **Token Security**: Keep GitHub token secure and private
2. **Minimal Permissions**: Use tokens with minimal required permissions
3. **Regular Rotation**: Rotate GitHub tokens periodically
4. **Local Storage**: Be aware that tokens are stored locally

### Workflow Integration
1. **Team Consistency**: Use consistent settings across team members
2. **Project Standards**: Align with project coding standards
3. **Editor Integration**: Leverage editor-specific features
4. **Package Management**: Use GitHub integration for dependencies

## Troubleshooting

### Common Issues

#### "Configuration file not found"
**Cause**: First-time usage or file corruption
**Solution**: Run `pawnctl setup` to create initial configuration

#### "Invalid GitHub token"
**Cause**: Token expired or has insufficient permissions
**Solution**: Generate new token with proper permissions

#### "Permission denied"
**Cause**: Insufficient file system permissions
**Solution**: Check directory permissions or run as administrator

#### "Editor not supported"
**Cause**: Selected editor doesn't have integration support
**Solution**: Choose supported editor or use "Other/None"

### Getting Help

- **View current settings**: Run `pawnctl config` to see all settings
- **Reset configuration**: Use "Reset all configuration" option
- **Manual editing**: Edit preferences.json file directly
- **Re-run setup**: Use `pawnctl setup --force` to reconfigure

### Recovery Steps

1. **Check current settings**: `pawnctl config`
2. **Identify problematic setting**: Look for error messages
3. **Reset specific setting**: Use config command to update
4. **Reset all settings**: Use "Reset all configuration" option
5. **Re-run setup**: `pawnctl setup --force` if needed

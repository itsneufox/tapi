# `setup` Command

Configure tapi settings for first-time use through an interactive setup wizard.

## Overview

The `setup` command provides an interactive wizard to configure tapi for first-time use. It guides users through essential configuration options including default author information, preferred editor settings, and GitHub integration. The setup process is designed to be user-friendly and only needs to be completed once.

## Usage

```bash
tapi setup [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --force` | Force setup even if already configured | false |

## Features

### Interactive Setup Wizard
- **Guided Configuration**: Step-by-step setup process
- **Sensible Defaults**: Pre-filled values based on system information
- **Input Validation**: Ensures valid configuration values
- **One-time Setup**: Designed to be completed once per user

### Configuration Categories
1. **Default Author**: Set your name for new projects
2. **Editor Preference**: Choose your preferred code editor
3. **GitHub Integration**: Configure GitHub token for package installation
4. **Setup Status**: Track completion status

### Persistent Storage
- **Automatic Saving**: Configuration saved immediately after each step
- **Cross-Session Persistence**: Settings persist between command sessions
- **Backup Support**: Configuration can be reset and re-run
- **Validation**: Input validation and error handling

## Setup Process

### 1. Welcome and Introduction
- Displays welcome message and setup purpose
- Explains what will be configured
- Provides context for each configuration option

### 2. Default Author Configuration
- Prompts for author name to use in new projects
- Pre-fills with existing configuration if available
- Validates input and provides feedback

### 3. Editor Preference Selection
- Presents available editor options
- Explains integration features for each editor
- Saves preference for project setup

### 4. GitHub Integration (Optional)
- Offers to configure GitHub token
- Explains benefits of GitHub integration
- Handles token input securely

### 5. Completion and Summary
- Confirms all settings have been saved
- Provides next steps and usage information
- Shows how to modify settings later

## Examples

### First-Time Setup
```bash
$ tapi setup

=== Welcome to tapi! ===
This one-time setup will help configure tapi for your use.

✔ What name would you like to use as the default author for your projects? Developer
✔ Which code editor do you use most for PAWN development? VS Code
✔ Would you like to configure GitHub integration? Yes
✔ Enter your GitHub personal access token: ****************

=== Setup complete! ===
✓ Default author: Developer
✓ Preferred editor: VS Code
✓ GitHub integration: Configured

You can now use tapi. To change these settings in the future, run: tapi config
```

### Setup with Existing Configuration
```bash
$ tapi setup

Setup has already been completed.

Your current configuration:
• Default author: Developer
• Preferred editor: VS Code
• GitHub integration: Configured

To force setup to run again, use: tapi setup --force
To edit individual settings, use: tapi config
```

### Force Setup (Reconfigure)
```bash
$ tapi setup --force

=== Welcome to tapi! ===
This one-time setup will help configure tapi for your use.

✔ What name would you like to use as the default author for your projects? New Developer
✔ Which code editor do you use most for PAWN development? Sublime Text
✔ Would you like to configure GitHub integration? No

=== Setup complete! ===
✓ Default author: New Developer
✓ Preferred editor: Sublime Text
✓ GitHub integration: Not configured

You can now use tapi. To change these settings in the future, run: tapi config
```

### Setup with Different Editor Options
```bash
$ tapi setup

=== Welcome to tapi! ===
This one-time setup will help configure tapi for your use.

✔ What name would you like to use as the default author for your projects? Developer
✔ Which code editor do you use most for PAWN development? Other/None
✔ Would you like to configure GitHub integration? Yes
✔ Enter your GitHub personal access token: ****************

=== Setup complete! ===
✓ Default author: Developer
✓ Preferred editor: Other/None
✓ GitHub integration: Configured

You can now use tapi. To change these settings in the future, run: tapi config
```

## Configuration Options

### Default Author
**Purpose**: Sets the default author name for new projects
**Location**: `~/.tapi/preferences.json`
**Key**: `defaultAuthor`
**Example**: `"Developer Name"`

**Usage**: This name will be pre-filled in the author field when running `tapi init`

### Preferred Editor
**Purpose**: Determines which editor integration files to generate
**Location**: `~/.tapi/preferences.json`
**Key**: `editor`
**Options**:
- **VS Code**: Full integration with tasks, debugging, and IntelliSense
- **Sublime Text**: Basic configuration and syntax highlighting
- **Other/None**: No editor-specific setup

**Usage**: Affects which editor files are created during `tapi init`

### GitHub Integration
**Purpose**: Enables package installation from GitHub repositories
**Location**: `~/.tapi/preferences.json`
**Key**: `githubToken`
**Example**: `"ghp_xxxxxxxxxxxxxxxxxxxx"`

**Benefits**:
- Access to private repositories
- Increased API rate limits
- Better package installation experience

### Setup Status
**Purpose**: Tracks whether initial setup has been completed
**Location**: `~/.tapi/preferences.json`
**Key**: `setupComplete`
**Example**: `true`

**Usage**: Prevents setup wizard from running automatically on subsequent uses

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
C:\Users\<username>\.tapi\preferences.json
```

#### Linux/macOS
```
~/.tapi/preferences.json
```

## Interactive Prompts

### Author Name Prompt
```
What name would you like to use as the default author for your projects?
✔ Developer Name
```

### Editor Selection Prompt
```
Which code editor do you use most for PAWN development?
✔ Select an option › [Use arrow keys to navigate]
  • Visual Studio Code (recommended)
  • Sublime Text
  • Other/None
```

### GitHub Integration Prompt
```
Would you like to configure GitHub integration? (for package installations)
✔ Yes/No › Yes

Enter your GitHub personal access token (optional, press Enter to skip):
✔ ****************
```

## Integration with Other Commands

### init Command
- **Default Author**: Pre-fills author field in interactive prompts
- **Editor Preference**: Determines which editor files to generate
- **Setup Status**: Affects whether setup wizard runs automatically

### config Command
- **Configuration Source**: Uses settings configured during setup
- **Modification Interface**: Provides way to change setup values
- **Reset Options**: Allows resetting to setup defaults

### install Command
- **GitHub Token**: Used for package installation from GitHub
- **Rate Limits**: Increases API rate limits for authenticated requests
- **Private Repos**: Enables access to private repositories

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
tapi config

# Update token
tapi config
# Select "GitHub integration" → "Update the token"

# Remove token
tapi config
# Select "GitHub integration" → "Remove the token"
```

## Error Handling

### Common Setup Errors

#### Permission Issues
```bash
✗ Failed to save configuration
  Error: EACCES: permission denied
  Solution: Check directory permissions or run as administrator
```

#### Invalid Input
```bash
✗ Invalid input provided
  Error: Author name cannot be empty
  Solution: Provide a valid author name
```

#### Network Issues (GitHub)
```bash
✗ Failed to validate GitHub token
  Error: Network timeout
  Solution: Check internet connection and try again
```

### Recovery Options

1. **Force Setup**: Use `--force` flag to re-run setup
2. **Manual Configuration**: Use `tapi config` to modify settings
3. **Delete Configuration**: Remove preferences.json to start fresh
4. **Re-run Setup**: Use `tapi setup --force`

## Best Practices

### Setup Process
1. **Complete Setup**: Run setup before using other commands
2. **Use Real Name**: Set your actual name as default author
3. **Choose Editor**: Select your preferred editor for integration
4. **Configure GitHub**: Set up token for package installation

### Configuration Management
1. **One-time Setup**: Complete setup once per user
2. **Regular Review**: Use `tapi config` to review settings
3. **Update as Needed**: Modify settings when preferences change
4. **Backup Configuration**: Keep backup of preferences.json

### Security
1. **Token Security**: Keep GitHub token secure and private
2. **Minimal Permissions**: Use tokens with minimal required permissions
3. **Regular Rotation**: Rotate GitHub tokens periodically
4. **Local Storage**: Be aware that tokens are stored locally

## Troubleshooting

### Common Issues

#### "Setup has already been completed"
**Cause**: Setup wizard has been run before
**Solution**: Use `--force` flag to re-run setup

#### "Permission denied"
**Cause**: Insufficient file system permissions
**Solution**: Check directory permissions or run as administrator

#### "Invalid GitHub token"
**Cause**: Token expired or has insufficient permissions
**Solution**: Generate new token with proper permissions

#### "Configuration file not found"
**Cause**: First-time usage or file corruption
**Solution**: Run setup to create initial configuration

### Getting Help

- **Force setup**: Use `--force` to re-run setup wizard
- **Manual configuration**: Use `tapi config` to modify settings
- **Reset configuration**: Use config command to reset settings
- **Check status**: Run `tapi config` to view current settings

### Recovery Steps

1. **Check setup status**: Run `tapi setup` to see current status
2. **Force re-setup**: Use `tapi setup --force` to reconfigure
3. **Manual configuration**: Use `tapi config` for individual settings
4. **Reset to defaults**: Use config command to reset all settings
5. **Delete and restart**: Remove preferences.json and run setup again

## Next Steps After Setup

### Immediate Actions
1. **Test Configuration**: Run `tapi config` to verify settings
2. **Create Project**: Run `tapi init` to create your first project
3. **Install Packages**: Use `tapi install` to add dependencies

### Ongoing Usage
1. **Modify Settings**: Use `tapi config` to change preferences
2. **Update Token**: Refresh GitHub token when needed
3. **Review Settings**: Periodically review configuration

### Advanced Usage
1. **Custom Configuration**: Edit preferences.json directly
2. **Team Settings**: Share configuration across team members
3. **Automation**: Use configuration in automated workflows

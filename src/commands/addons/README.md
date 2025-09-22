# Addon Commands Implementation

This directory contains the implementation of pawnctl's addon management commands.

## Overview

The addon commands allow users to install, manage, and use pawnctl addons - extensions that can modify `pawn.json`, add custom commands, and hook into pawnctl's lifecycle.

## Commands

### `index.ts` - Main Command Registration
- Registers the `addon` command group
- Shows help when no subcommand is provided
- Coordinates all addon subcommands

### `install.ts` - Addon Installation
**Command:** `pawnctl addon install <addon>`

**Features:**
- Install addons from multiple sources (npm, GitHub, local)
- Support for global and local installation
- Duplicate installation detection
- Clear installation feedback

**Options:**
- `-g, --global` - Install globally for all projects
- `-s, --source <source>` - Specify installation source
- `--github <repo>` - Install from GitHub (user/repo)
- `--local <path>` - Install from local path

**Examples:**
```bash
pawnctl addon install linter
pawnctl addon install linter --global
pawnctl addon install --github username/repo
pawnctl addon install --local ./my-addon
```

### `uninstall.ts` - Addon Removal
**Command:** `pawnctl addon uninstall <addon>`

**Features:**
- Remove installed addons
- Force removal option
- Installation status checking
- Cleanup notifications

**Options:**
- `-f, --force` - Force removal without confirmation

**Examples:**
```bash
pawnctl addon uninstall linter
pawnctl addon uninstall linter --force
```

### `list.ts` - Addon Listing
**Command:** `pawnctl addon list`

**Features:**
- List installed addons with details
- Filter by status (enabled/disabled)
- Show all available addons
- Display addon metadata (version, author, license)

**Options:**
- `-a, --all` - Show all addons (installed and available)
- `-e, --enabled` - Show only enabled addons
- `-d, --disabled` - Show only disabled addons

**Examples:**
```bash
pawnctl addon list
pawnctl addon list --all
pawnctl addon list --enabled
```

### `enable.ts` - Addon Activation
**Command:** `pawnctl addon enable <addon>`

**Features:**
- Enable disabled addons
- Installation status verification
- Activation confirmation

**Examples:**
```bash
pawnctl addon enable linter
```

### `disable.ts` - Addon Deactivation
**Command:** `pawnctl addon disable <addon>`

**Features:**
- Disable enabled addons
- Installation status verification
- Deactivation confirmation

**Examples:**
```bash
pawnctl addon disable linter
```

## Integration with Addon System

These commands integrate with the core addon system:

### AddonManager Integration
- Uses `getAddonManager()` to access addon functionality
- Calls methods like `installAddon()`, `uninstallAddon()`, `listAddons()`
- Handles addon lifecycle management

### Error Handling
- Graceful error handling with user-friendly messages
- Proper exit codes for scripting
- Detailed error reporting

### User Experience
- Clear progress indicators
- Helpful success messages
- Next steps guidance
- Consistent command interface

## Command Flow

### Installation Flow
1. Parse command options and addon name
2. Determine installation source and path
3. Check for existing installation
4. Call AddonManager.installAddon()
5. Provide success feedback and next steps

### Listing Flow
1. Get addon list from AddonManager
2. Apply filters (enabled/disabled/all)
3. Format and display addon information
4. Show summary statistics

### Enable/Disable Flow
1. Verify addon is installed
2. Check current status
3. Call AddonManager.enableAddon()/disableAddon()
4. Provide confirmation

## Error Handling

All commands implement consistent error handling:

```typescript
try {
  // Command logic
} catch (error) {
  logger.error(`❌ Failed to [operation]: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}
```

## User Feedback

Commands provide clear feedback:

- **Progress indicators** - Show what's happening
- **Success messages** - Confirm completion
- **Next steps** - Guide users on what to do next
- **Error messages** - Explain what went wrong

## Installation Locations

Commands handle different installation scenarios:

### Global Installation (`--global`)
- Installs to `~/.pawnctl/addons/`
- Available to all projects
- Registry in `~/.pawnctl/addons.json`

### Local Installation (default)
- Installs to `./.pawnctl/addons/`
- Project-specific
- Registry in `~/.pawnctl/addons.json`

### npm Installation
- Discovers addons in `./node_modules/pawnctl-*`
- Automatic discovery and activation

## Testing

To test the addon commands:

```bash
# Test installation
pawnctl addon install --local ./examples/addons/greeter-addon

# Test listing
pawnctl addon list

# Test enable/disable
pawnctl addon disable greeter
pawnctl addon enable greeter

# Test uninstall
pawnctl addon uninstall greeter --force
```

## Future Enhancements

Potential improvements:

1. **Bulk operations** - Install/remove multiple addons
2. **Addon search** - Search available addons
3. **Addon updates** - Update installed addons
4. **Addon validation** - Validate addon integrity
5. **Addon dependencies** - Handle addon dependencies
6. **Addon configuration** - Configure addon settings
7. **Addon logging** - Detailed addon operation logs

## Dependencies

These commands depend on:

- **AddonManager** - Core addon functionality
- **Logger** - User feedback and error reporting
- **Banner** - Consistent UI display
- **Commander.js** - Command-line interface

## Code Style

Commands follow these patterns:

- **Consistent structure** - All commands follow similar patterns
- **Error handling** - Proper try/catch with user-friendly messages
- **User feedback** - Clear progress and success indicators
- **Option validation** - Validate command options
- **Exit codes** - Proper exit codes for scripting



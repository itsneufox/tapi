# `build` Command

Compile your PAWN code using the PAWN compiler with intelligent include path detection and optimized settings for open.mp development.

## Overview

The `build` command compiles your PAWN source code into AMX bytecode that can be executed by the open.mp server. It automatically detects include directories, applies optimized compiler settings, and provides clear error reporting.

## Usage

```bash
pawnctl build [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <file>` | Input .pwn file to compile | From pawn.json |
| `-o, --output <file>` | Output .amx file | From pawn.json |
| `-d, --debug <level>` | Debug level (1-3) | 3 |
| `-v, --verbose` | Show detailed debug output | false |

## Features

### Intelligent Include Detection

The build command automatically finds and includes the following directories in order of priority:

1. **pawno/include** - SA-MP includes (highest priority)
2. **qawno/include** - open.mp includes (second priority)
3. **compiler/include** - Community compiler includes (third priority)
4. **Custom includes** - User-defined include paths from pawn.json

### Configuration-Driven

The build process uses settings from your `pawn.json` manifest file:

```json
{
  "compiler": {
    "input": "gamemodes/my-gamemode.pwn",
    "output": "gamemodes/my-gamemode.amx",
    "includes": ["includes", "gamemodes"],
    "constants": {
      "MAX_PLAYERS": 50,
      "DEBUG": 1
    },
    "options": ["-d3", "-;+", "-(+", "-\\+", "-Z+"]
  }
}
```

### Optimized Compilation

Pre-configured compiler options optimized for open.mp development:

- **`-d3`**: Maximum debug information
- **`-;+`**: Enable semicolon warnings
- **`-(+`**: Enable parenthesis warnings
- **`-\\+`**: Enable backslash warnings
- **`-Z+`**: Enable zero-division warnings

### Error Reporting

Clear, formatted error messages with file and line numbers:

```
gamemodes/my-gamemode.pwn(15) : error 001: expected token: ";", but found "}"
gamemodes/my-gamemode.pwn(23) : warning 215: expression has no effect
```

## Compilation Process

### 1. Configuration Loading
- Loads `pawn.json` manifest file
- Validates project configuration
- Determines input/output files

### 2. Include Path Detection
- Scans for existing include directories
- Prioritizes include paths based on availability
- Validates include directory existence

### 3. Compiler Execution
- Constructs compiler command with all options
- Executes pawncc with proper arguments
- Captures and processes compiler output

### 4. Error Processing
- Parses compiler output for errors and warnings
- Formats error messages for readability
- Provides file and line number context

## Examples

### Basic Compilation
```bash
$ pawnctl build

=== Building PAWN project... ===
ℹ Input file: gamemodes/my-gamemode.pwn
ℹ Output file: gamemodes/my-gamemode.amx
ℹ Debug level: 3
ℹ Added include directory: qawno/include
ℹ Added include directory: includes
ℹ Added include directory: gamemodes
ℹ Compiler options: -d3 -;+ -(+ -\\+ -Z+
ℹ Constants: MAX_PLAYERS=50, DEBUG=1

Compiling gamemodes/my-gamemode.pwn...
✓ Compilation successful!
  Output: gamemodes/my-gamemode.amx
  Size: 45.2 KB
```

### Custom Input/Output
```bash
$ pawnctl build -i filterscripts/anticheat.pwn -o filterscripts/anticheat.amx

=== Building PAWN project... ===
ℹ Input file: filterscripts/anticheat.pwn
ℹ Output file: filterscripts/anticheat.amx
ℹ Debug level: 3
ℹ Added include directory: qawno/include
ℹ Added include directory: includes

Compiling filterscripts/anticheat.pwn...
✓ Compilation successful!
  Output: filterscripts/anticheat.amx
  Size: 12.8 KB
```

### Debug Level Control
```bash
$ pawnctl build -d 1

=== Building PAWN project... ===
ℹ Input file: gamemodes/my-gamemode.pwn
ℹ Output file: gamemodes/my-gamemode.amx
ℹ Debug level: 1
ℹ Added include directory: qawno/include
ℹ Added include directory: includes

Compiling gamemodes/my-gamemode.pwn...
✓ Compilation successful!
  Output: gamemodes/my-gamemode.amx
  Size: 38.7 KB (smaller due to reduced debug info)
```

### Verbose Output
```bash
$ pawnctl build --verbose

=== Building PAWN project... ===
ℹ Input file: gamemodes/my-gamemode.pwn
ℹ Output file: gamemodes/my-gamemode.amx
ℹ Debug level: 3
ℹ Added include directory: qawno/include
ℹ Added include directory: includes
ℹ Added include directory: gamemodes
ℹ Compiler options: -d3 -;+ -(+ -\\+ -Z+
ℹ Constants: MAX_PLAYERS=50, DEBUG=1
ℹ Full command: qawno/pawncc.exe -igamemodes/my-gamemode.pwn -oqawno/include -iincludes -igamemodes -d3 -;+ -(+ -\\+ -Z+ -DMAX_PLAYERS=50 -DDEBUG=1 gamemodes/my-gamemode.pwn

Compiling gamemodes/my-gamemode.pwn...
✓ Compilation successful!
  Output: gamemodes/my-gamemode.amx
  Size: 45.2 KB
```

## Error Handling

### Common Compilation Errors

#### Missing Include Files
```
gamemodes/my-gamemode.pwn(1) : fatal error 100: cannot read from file: "a_samp.inc"
```
**Solution**: Ensure qawno/include directory exists and contains required includes

#### Syntax Errors
```
gamemodes/my-gamemode.pwn(15) : error 001: expected token: ";", but found "}"
```
**Solution**: Check syntax at the specified line number

#### Undefined Symbols
```
gamemodes/my-gamemode.pwn(23) : error 017: undefined symbol "MAX_PLAYERS"
```
**Solution**: Define constants in pawn.json or include proper header files

#### Include Path Issues
```
ℹ Skipped non-existent include directory: custom/includes
```
**Solution**: Remove non-existent include paths from pawn.json

### Error Recovery

The build command provides helpful error information:

1. **File and line numbers** for precise error location
2. **Error codes** for quick reference
3. **Context information** about include paths and compiler options
4. **Suggestions** for common error resolution

## Configuration

### pawn.json Compiler Settings

```json
{
  "compiler": {
    "input": "gamemodes/my-gamemode.pwn",
    "output": "gamemodes/my-gamemode.amx",
    "includes": [
      "includes",
      "gamemodes",
      "custom/path"
    ],
    "constants": {
      "MAX_PLAYERS": 50,
      "DEBUG": 1,
      "VERSION": "1.0.0"
    },
    "options": [
      "-d3",
      "-;+",
      "-(+",
      "-\\+",
      "-Z+",
      "-v"
    ]
  }
}
```

### Include Directory Priority

1. **User-defined includes** (from pawn.json)
2. **pawno/include** (SA-MP includes)
3. **qawno/include** (open.mp includes)
4. **compiler/include** (Community compiler includes)

## Debug Levels

### Level 1 (Minimal)
- Basic debug information
- Smaller output file size
- Faster compilation

### Level 2 (Standard)
- Standard debug information
- Balanced file size and debugging capability

### Level 3 (Maximum) - Default
- Full debug information
- Largest output file size
- Best debugging experience

## Performance Tips

### Optimize Compilation Speed
- Use debug level 1 for production builds
- Minimize include directories
- Use specific input files instead of relying on defaults

### Reduce Output Size
- Use debug level 1
- Remove unused includes
- Optimize PAWN code

### Improve Error Detection
- Use debug level 3 during development
- Enable all compiler warnings
- Use verbose mode for detailed information

## Integration

### VS Code Integration
When using VS Code, the build command integrates with:
- **Build tasks** (Ctrl+Shift+B)
- **Error reporting** in Problems panel
- **Quick fixes** and suggestions

### Continuous Integration
The build command is suitable for CI/CD pipelines:
```bash
# In CI script
pawnctl build --quiet
if [ $? -eq 0 ]; then
  echo "Build successful"
else
  echo "Build failed"
  exit 1
fi
```

## Troubleshooting

### Common Issues

#### "No pawn.json manifest found"
**Cause**: Not in a pawnctl project directory
**Solution**: Run `pawnctl init` to create a project

#### "Input file not found"
**Cause**: Specified input file doesn't exist
**Solution**: Check file path or use `--input` to specify correct file

#### "Compiler not found"
**Cause**: PAWN compiler not installed
**Solution**: Run `pawnctl init` to install compiler

#### "Include directory not found"
**Cause**: Include path doesn't exist
**Solution**: Remove non-existent paths from pawn.json or create directories

### Getting Help

- **Verbose mode**: Use `--verbose` for detailed compiler information
- **Check configuration**: Verify pawn.json settings
- **Validate includes**: Ensure include directories exist and contain required files
- **Review errors**: Check error messages for specific issues and line numbers

# Neufox PAWN Tools (npt)

A command-line interface tool for SA-MP/open.mp development that helps manage packages and build PAWN projects.

> ⚠️ **WARNING**: This tool is currently in development and may contain bugs and has incomplete features. DON'T USE ON PRODUCTION SERVERS!!!

## For Developers

To set up the project for development:

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/neufox-pawn-tools.git
   cd neufox-pawn-tools
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Create a symlink to use the development version globally:
   ```bash
   npm link
   ```

   This will allow you to run `npt` from anywhere while working on the source code.

5. To unlink after development:
   ```bash
   npm unlink -g neufox-pawn-tools
   ```

## Usage

### Initialize a new project

```bash
npt init
```

Follow the interactive prompts to set up your project.

### Build a project

```bash
npt build
```
Or you can press CTRL+SHFT+B in VS Code.

### Start the server

```bash
npt start
```
Or you can press F5 in VS Code.

## Advanced Options

Each command supports additional options. You can also use `--help` with any command to see available options.

```bash
npt init --help
npt build --help
npt start --help
```

Add `--verbose` to any command for detailed output:

```bash
npt init --verbose
npt build --verbose
npt start --verbose
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
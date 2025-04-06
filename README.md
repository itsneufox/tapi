# >_pawnctl

A command-line interface tool for SA-MP/open.mp development that helps manage packages and build PAWN projects.

> ⚠️ **WARNING**: This tool is currently in development and may contain bugs and has incomplete features. DON'T USE ON PRODUCTION SERVERS!!!

## For Developers

To set up the project for development:

1. Clone this repository:
   ```bash
   git clone https://github.com/itsneufox/pawnctl.git
   cd pawnctl
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

   This will allow you to run `pawnctl` from anywhere while working on the source code.

5. To unlink after development:
   ```bash
   npm unlink -g pawnctl
   ```

## Usage

### Initialize a new project

```bash
pawnctl init
```

Follow the interactive prompts to set up your project.

### Build a project

```bash
pawnctl build
```
Or you can press CTRL+SHFT+B in VS Code.

### Start the server

```bash
pawnctl start
```
Or you can press F5 in VS Code.

## Advanced Options

Each command supports additional options. You can also use `--help` with any command to see available options.

```bash
pawnctl init --help
pawnctl build --help
pawnctl start --help
```

Add `--verbose` to any command for detailed output:

```bash
pawnctl init --verbose
pawnctl build --verbose
pawnctl start --verbose
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

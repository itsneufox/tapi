# Contributing to pawnctl

Thank you for your interest in contributing to pawnctl! This guide will help you get started with development and contributing to the project.

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **Git**
- **TypeScript** knowledge
- Basic understanding of PAWN and SA-MP/open.mp

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/pawnctl.git
   cd pawnctl
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Link for local development:**
   ```bash
   npm run dev
   ```
   This builds and creates a global symlink so you can test `pawnctl` commands locally.

5. **Run tests:**
   ```bash
   npm test
   ```

## 📁 Project Structure

```
pawnctl/
├── src/                    # TypeScript source code
│   ├── commands/           # CLI command implementations
│   │   ├── init/          # Project initialization
│   │   ├── build/         # Code compilation
│   │   ├── start/         # Server management
│   │   ├── config/        # Configuration management
│   │   ├── install/       # Package installation
│   │   └── kill/          # Process termination
│   ├── core/              # Core functionality
│   │   └── manifest.ts    # pawn.json handling
│   ├── utils/             # Utility functions
│   │   ├── logger.ts      # Logging system
│   │   ├── config.ts      # User configuration
│   │   ├── banner.ts      # CLI branding
│   │   └── serverState.ts # Server process management
│   └── templates/         # Project templates
│       ├── projects/      # Code templates
│       ├── vscode/        # VS Code integration
│       └── common/        # Shared templates
├── tests/                 # Test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test data
├── dist/                 # Compiled JavaScript (generated)
└── bin/                  # CLI entry point
```

## 🛠️ Development Workflow

### Adding a New Command

1. **Create command directory:**
   ```bash
   mkdir src/commands/yourcommand
   ```

2. **Create main implementation:**
   ```typescript
   // src/commands/yourcommand/yourcommand.ts
   import { Command } from 'commander';
   import { showBanner } from '../../utils/banner';
   import { logger } from '../../utils/logger';

   export default function (program: Command): void {
     program
       .command('yourcommand')
       .description('Description of your command')
       .option('-o, --option <value>', 'command option')
       .action(async (options) => {
         showBanner(false);
         
         try {
           // Your command logic here
           logger.success('✅ Command completed successfully');
         } catch (error) {
           logger.error(`❌ Command failed: ${error instanceof Error ? error.message : 'unknown error'}`);
           process.exit(1);
         }
       });
   }
   ```

3. **Create documentation:**
   ```markdown
   <!-- src/commands/yourcommand/README.md -->
   # `yourcommand` Command
   
   Brief description of what the command does.
   
   ## Usage
   ```bash
   pawnctl yourcommand [options]
   ```
   
   ## Options
   
   | Option | Description | Default |
   |--------|-------------|---------|
   | `-o, --option <value>` | Option description | - |
   ```

4. **Add tests:**
   ```typescript
   // tests/unit/yourcommand.test.ts
   import yourcommand from '../../src/commands/yourcommand/yourcommand';
   
   describe('yourcommand', () => {
     test('should work correctly', () => {
       // Your tests here
     });
   });
   ```

### Testing

- **Run all tests:** `npm test`
- **Run tests with coverage:** `npm run test:coverage`
- **Run tests in watch mode:** `npm run test:watch`
- **Run specific test:** `npm test -- yourtest.test.ts`

### Code Style

We use ESLint and TypeScript for code quality:

- **Lint code:** `npm run lint`
- **Fix linting issues:** `npm run lint:fix`
- **Type checking:** `npm run type-check`

### Building

- **Development build:** `npm run build`
- **Production build:** `npm run build && npm run dev`

## 📝 Coding Guidelines

### General Principles

1. **User Experience First:** Always consider the developer using pawnctl
2. **Cross-Platform:** Support Windows, macOS, and Linux
3. **Clear Error Messages:** Provide helpful, actionable error messages
4. **Consistent API:** Follow established patterns in the codebase
5. **Documentation:** Document all public APIs and commands

### TypeScript Style

```typescript
// ✅ Good: Use interfaces for type safety
interface BuildOptions {
  verbose?: boolean;
  output?: string;
}

// ✅ Good: Use proper error handling
try {
  await buildProject(options);
  logger.success('✅ Build completed');
} catch (error) {
  logger.error(`❌ Build failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}

// ✅ Good: Use descriptive function names
async function validateServerConfiguration(configPath: string): Promise<void>

// ❌ Avoid: Using 'any' type
function processData(data: any): any // Use proper types instead
```

### Logging Style

```typescript
// ✅ Use consistent emoji patterns
logger.success('✅ Operation completed');
logger.error('❌ Operation failed');
logger.warn('⚠️ Warning message');
logger.info('ℹ️ Information');
logger.working('Working on task...');

// ✅ Structure output with headings
logger.heading('=== Building Project ===');
logger.subheading('Compilation Results:');
logger.list(['✅ File 1 compiled', '❌ File 2 failed']);
```

## 🧪 Testing Guidelines

### Test Structure

```typescript
describe('CommandName', () => {
  beforeEach(() => {
    // Setup for each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('when condition X', () => {
    test('should behave correctly', async () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### What to Test

- **Happy path scenarios**
- **Error conditions**
- **Edge cases**
- **Cross-platform behavior**
- **File system operations**
- **External process interactions**

## 📋 Pull Request Process

### Before Submitting

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding guidelines

3. **Add tests** for new functionality

4. **Update documentation** if needed

5. **Ensure all checks pass:**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

6. **Test manually** with `npm run dev`

### Pull Request Guidelines

1. **Clear title:** Use descriptive PR titles
   - ✅ "Add watch mode to start command"
   - ❌ "Fix stuff"

2. **Detailed description:**
   - What does this PR do?
   - Why is this change needed?
   - How has it been tested?
   - Any breaking changes?

3. **Link related issues** using keywords:
   ```
   Fixes #123
   Closes #456
   Related to #789
   ```

4. **Keep PRs focused:** One feature/fix per PR

5. **Update documentation** for user-facing changes

## 🐛 Reporting Issues

### Bug Reports

Include:
- **pawnctl version:** `pawnctl --version`
- **Operating system:** Windows 10, macOS 12, Ubuntu 20.04, etc.
- **Node.js version:** `node --version`
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Error messages** (with full stack traces)
- **Project structure** if relevant

### Feature Requests

Include:
- **Use case:** Why is this feature needed?
- **Proposed solution:** How should it work?
- **Alternatives considered:** Other ways to solve the problem
- **Examples:** Show how the feature would be used

## 🔧 Development Tips

### Debugging

```typescript
// Use logger for debugging
logger.detail('Debug info in verbose mode');

// Use environment variables for debug builds
if (process.env.PAWNCTL_DEBUG) {
  console.log('Debug information');
}
```

### Testing Locally

```bash
# Build and link for testing
npm run dev

# Test in a sample project directory
cd /path/to/test/project
pawnctl init
pawnctl build
pawnctl start --watch
```

### Working with Templates

Templates are in `src/templates/` and get copied to `dist/templates/` during build. After modifying templates:

```bash
npm run copy-templates
```

## 📚 Resources

### External Documentation
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [Chokidar](https://github.com/paulmillr/chokidar) - File watching
- [Jest](https://jestjs.io/) - Testing framework

### SA-MP/open.mp Resources
- [open.mp Documentation](https://www.open.mp/docs)
- [SA-MP Wiki](https://wiki.sa-mp.com/)
- [PAWN Language Guide](https://github.com/pawn-lang/compiler)

## 🤝 Community

- **Questions?** Open a GitHub Discussion
- **Found a bug?** Open a GitHub Issue
- **Want to contribute?** Open a Pull Request
- **Need help?** Check existing issues and discussions

## 📄 License

By contributing to pawnctl, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to pawnctl! 🎉

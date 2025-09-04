import { Command } from 'commander';

describe('Command Registration', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
  });

  test('should create commander program successfully', () => {
    expect(program).toBeDefined();
    expect(program.commands).toBeDefined();
    expect(Array.isArray(program.commands)).toBe(true);
  });

  test('should allow adding commands to program', () => {
    const testCommand = program
      .command('test')
      .description('A test command')
      .action(() => {});

    expect(testCommand).toBeDefined();
    expect(program.commands).toHaveLength(1);
    expect(program.commands[0].name()).toBe('test');
  });

  test('should register command with options', () => {
    program
      .command('test-with-options')
      .description('Test command with options')
      .option('-v, --verbose', 'verbose output')
      .option('-q, --quiet', 'quiet mode')
      .action(() => {});

    const command = program.commands[0];
    expect(command.name()).toBe('test-with-options');
    expect(command.description()).toBe('Test command with options');
    expect(command.options).toHaveLength(2); // our custom options only
  });
});

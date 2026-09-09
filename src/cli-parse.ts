export const HELP_TEXT = `dotts init [dir]
dotts prepare [dir]
dotts check [path]
dotts apply [path] [--dry-run]
dotts doctor
dotts secrets set <name> <value>
dotts secrets list
dotts secrets remove <name>`;

export type CliRequest =
  | { kind: 'interactive' }
  | { kind: 'help' }
  | { kind: 'init'; projectDir: string }
  | { kind: 'prepare'; dir: string }
  | { kind: 'check'; configPath: string }
  | { kind: 'doctor' }
  | { kind: 'apply'; configPath: string; dryRun: boolean }
  | { kind: 'secrets-set'; name: string; value: string }
  | { kind: 'secrets-list' }
  | { kind: 'secrets-remove'; name: string };

function firstNonFlag(args: string[]): string | undefined {
  for (const arg of args) {
    if (!arg.startsWith('-')) return arg;
  }
  return undefined;
}

export function parseArgv(argv: string[]): CliRequest {
  if (argv.length === 0) {
    return { kind: 'interactive' };
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' };
  }

  const command = argv[0];
  if (!command) {
    return { kind: 'interactive' };
  }

  if (command === 'init') {
    const projectDir = firstNonFlag(argv.slice(1)) || './my-dotfiles';
    return { kind: 'init', projectDir };
  }

  if (command === 'prepare') {
    const dir = firstNonFlag(argv.slice(1)) || process.cwd();
    return { kind: 'prepare', dir };
  }

  if (command === 'check') {
    const configPath = firstNonFlag(argv.slice(1)) || './dotts.ts';
    return { kind: 'check', configPath };
  }

  if (command === 'doctor') {
    return { kind: 'doctor' };
  }

  if (command === 'apply') {
    const dryRun = argv.includes('--dry-run');
    const configPath = firstNonFlag(argv.slice(1)) || './dotts.ts';
    return { kind: 'apply', configPath, dryRun };
  }

  if (command === 'secrets') {
    const action = argv[1];
    if (action === 'set') {
      const name = argv[2];
      const value = argv[3];
      if (!name || !value) {
        throw new Error('Usage: dotts secrets set <name> <value>');
      }
      return { kind: 'secrets-set', name, value };
    }
    if (action === 'list') {
      return { kind: 'secrets-list' };
    }
    if (action === 'remove') {
      const name = argv[2];
      if (!name) {
        throw new Error('Usage: dotts secrets remove <name>');
      }
      return { kind: 'secrets-remove', name };
    }
    throw new Error('Usage: dotts secrets <set|list|remove>');
  }

  throw new Error(`Unknown command: ${command}`);
}

export const HELP_TEXT = `dotts init [--force] [dir]
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
  | { kind: 'init'; projectDir: string; force: boolean }
  | { kind: 'prepare'; dir: string }
  | { kind: 'check'; configPath: string }
  | { kind: 'doctor' }
  | { kind: 'apply'; configPath: string; dryRun: boolean }
  | { kind: 'secrets-set'; name: string; value: string }
  | { kind: 'secrets-list' }
  | { kind: 'secrets-remove'; name: string };

function isHelpFlag(arg: string): boolean {
  return arg === '--help' || arg === '-h';
}

function takeArgs(rest: string[], knownFlags: string[]): { positional?: string; flags: Set<string> } {
  const known = new Set(knownFlags);
  const flags = new Set<string>();
  let positional: string | undefined;
  for (const arg of rest) {
    if (arg.startsWith('-')) {
      if (!known.has(arg)) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      flags.add(arg);
      continue;
    }
    if (positional === undefined) positional = arg;
  }
  return { positional, flags };
}

export function parseArgv(argv: string[]): CliRequest {
  if (argv.length === 0) {
    return { kind: 'interactive' };
  }

  const command = argv[0];
  if (!command) {
    return { kind: 'interactive' };
  }

  if (argv.length === 1 && isHelpFlag(command)) {
    return { kind: 'help' };
  }

  const afterCommand = argv[1];
  if (afterCommand !== undefined && isHelpFlag(afterCommand)) {
    return { kind: 'help' };
  }

  if (command === 'init') {
    const { positional, flags } = takeArgs(argv.slice(1), ['--force']);
    return { kind: 'init', projectDir: positional || './my-dotfiles', force: flags.has('--force') };
  }

  if (command === 'prepare') {
    const { positional } = takeArgs(argv.slice(1), []);
    return { kind: 'prepare', dir: positional || process.cwd() };
  }

  if (command === 'check') {
    const { positional } = takeArgs(argv.slice(1), []);
    return { kind: 'check', configPath: positional || './dotts.ts' };
  }

  if (command === 'doctor') {
    takeArgs(argv.slice(1), []);
    return { kind: 'doctor' };
  }

  if (command === 'apply') {
    const { positional, flags } = takeArgs(argv.slice(1), ['--dry-run']);
    return { kind: 'apply', configPath: positional || './dotts.ts', dryRun: flags.has('--dry-run') };
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

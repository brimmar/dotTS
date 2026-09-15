export const HELP_TEXT = `dotts init [--force] [dir]
dotts prepare [dir]
dotts check [path] [--json]
dotts apply [path] [--dry-run] [--yes|-y] [--verbose|-v] [--json]
dotts doctor [--json]
dotts secrets get <name>
dotts secrets set <name> <value>
dotts secrets list [--json]
dotts secrets remove <name>`;

export type CliRequest =
  | { kind: "interactive" }
  | { kind: "help" }
  | { kind: "init"; projectDir: string; force: boolean }
  | { kind: "prepare"; dir: string }
  | { kind: "check"; configPath: string; json?: boolean }
  | { kind: "doctor"; json?: boolean }
  | {
      kind: "apply";
      configPath: string;
      dryRun: boolean;
      yes?: boolean;
      verbose?: boolean;
      json?: boolean;
    }
  | { kind: "secrets-get"; name: string }
  | { kind: "secrets-set"; name: string; value: string }
  | { kind: "secrets-list"; json?: boolean }
  | { kind: "secrets-remove"; name: string };

function isHelpFlag(arg: string): boolean {
  return arg === "--help" || arg === "-h";
}

function takeArgs(
  rest: string[],
  knownFlags: string[],
): { positional?: string; flags: Set<string> } {
  const known = new Set(knownFlags);
  const flags = new Set<string>();
  let positional: string | undefined;
  for (const arg of rest) {
    if (arg.startsWith("-")) {
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
    return { kind: "interactive" };
  }

  const command = argv[0];
  if (!command) {
    return { kind: "interactive" };
  }

  if (argv.length === 1 && isHelpFlag(command)) {
    return { kind: "help" };
  }

  const afterCommand = argv[1];
  if (afterCommand !== undefined && isHelpFlag(afterCommand)) {
    return { kind: "help" };
  }

  if (command === "init") {
    const { positional, flags } = takeArgs(argv.slice(1), ["--force"]);
    return {
      kind: "init",
      projectDir: positional || "./my-dotfiles",
      force: flags.has("--force"),
    };
  }

  if (command === "prepare") {
    const { positional } = takeArgs(argv.slice(1), []);
    return { kind: "prepare", dir: positional || process.cwd() };
  }

  if (command === "check") {
    const { positional, flags } = takeArgs(argv.slice(1), ["--json"]);
    return {
      kind: "check",
      configPath: positional || "./dotts.ts",
      ...(flags.has("--json") ? { json: true } : {}),
    };
  }

  if (command === "doctor") {
    const { flags } = takeArgs(argv.slice(1), ["--json"]);
    return {
      kind: "doctor",
      ...(flags.has("--json") ? { json: true } : {}),
    };
  }

  if (command === "apply") {
    const { positional, flags } = takeArgs(argv.slice(1), [
      "--dry-run",
      "--yes",
      "-y",
      "--verbose",
      "-v",
      "--json",
    ]);
    const yes = flags.has("--yes") || flags.has("-y");
    const verbose = flags.has("--verbose") || flags.has("-v");
    const json = flags.has("--json");
    return {
      kind: "apply",
      configPath: positional || "./dotts.ts",
      dryRun: flags.has("--dry-run"),
      ...(yes ? { yes: true } : {}),
      ...(verbose ? { verbose: true } : {}),
      ...(json ? { json: true } : {}),
    };
  }

  if (command === "secrets") {
    const action = argv[1];
    if (action === "get") {
      const name = argv[2];
      if (!name) {
        throw new Error("Usage: dotts secrets get <name>");
      }
      return { kind: "secrets-get", name };
    }
    if (action === "set") {
      const name = argv[2];
      const value = argv[3];
      if (!name || !value) {
        throw new Error("Usage: dotts secrets set <name> <value>");
      }
      return { kind: "secrets-set", name, value };
    }
    if (action === "list") {
      const { flags } = takeArgs(argv.slice(2), ["--json"]);
      return {
        kind: "secrets-list",
        ...(flags.has("--json") ? { json: true } : {}),
      };
    }
    if (action === "remove") {
      const name = argv[2];
      if (!name) {
        throw new Error("Usage: dotts secrets remove <name>");
      }
      return { kind: "secrets-remove", name };
    }
    throw new Error("Usage: dotts secrets <get|set|list|remove>");
  }

  throw new Error(`Unknown command: ${command}`);
}

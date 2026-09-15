export const GLOBAL_HELP = `dotts - Declarative dotfiles management with TypeScript

Usage:
  dotts [command] [options]
  dotts [options]

Commands:
  init [dir]                     Initialize a new dotts configuration project
  prepare [dir]                  Refresh TypeScript editor definitions in .dotts/types
  check [path]                   Validate a dotts.ts configuration without applying
  apply [path]                   Apply system configuration (packages, files, symlinks)
  doctor                         Run system diagnostics and verify required tools
  secrets <action>               Manage encrypted secrets vault (.dotts/vault)

Options:
  -v, --version                  Print CLI version
  -h, --help                     Show help for dotts or a specific command

Run 'dotts <command> --help' for more information on a specific command.`;

export const INIT_HELP = `dotts init - Initialize a new dotts configuration project

Usage:
  dotts init [dir] [options]

Arguments:
  dir                            Target directory (default: ./my-dotfiles)

Options:
  --force                        Overwrite existing configuration files if present
  -h, --help                     Show this help message

Examples:
  dotts init
  dotts init ~/dotfiles
  dotts init --force .`;

export const PREPARE_HELP = `dotts prepare - Refresh TypeScript editor definitions and type declarations

Usage:
  dotts prepare [dir] [options]

Arguments:
  dir                            Project root containing tsconfig.json (default: current directory)

Options:
  -h, --help                     Show this help message

Description:
  Generates and refreshes .dotts/types/index.d.ts so your editor
  provides full autocomplete and type checking for dotts resources.
  Run this after upgrading the dotts CLI.

Examples:
  dotts prepare
  dotts prepare ~/dotfiles`;

export const CHECK_HELP = `dotts check - Validate a configuration file without executing side effects

Usage:
  dotts check [path] [options]

Arguments:
  path                           Path to the configuration file (default: ./dotts.ts)

Options:
  --json                         Output validation report as structured JSON
  -h, --help                     Show this help message

Description:
  Loads the configuration, builds the dependency graph, verifies secret
  references exist in .dotts/vault, and checks executable prerequisites.

Examples:
  dotts check
  dotts check ./dotts.ts
  dotts check --json`;

export const APPLY_HELP = `dotts apply - Apply declarative system configurations to the local machine

Usage:
  dotts apply [path] [options]

Arguments:
  path                           Path to dotts configuration file or repository shorthand
                                 (e.g., ./dotts.ts, ~/dotfiles, or user/repo) (default: ./dotts.ts)

Options:
  --dry-run                      Preview planned changes without modifying the system
  -y, --yes                      Skip interactive confirmation prompt
  -v, --verbose                  Show detailed command execution and output
  --json                         Output execution summary and resource results as JSON
  -h, --help                     Show this help message

Description:
  Evaluates the configuration graph and reconciles system state in dependency order.
  Tracks state in ~/.dotts/state.json to detect additions, changes, and deletions.
  Each applied resource reports its execution duration on the right.

Examples:
  dotts apply --dry-run
  dotts apply -y
  dotts apply ./dotts.ts --verbose
  dotts apply --json
  dotts apply brimmar/dotfiles -y`;

export const DOCTOR_HELP = `dotts doctor - Run system diagnostics and verify tool prerequisites

Usage:
  dotts doctor [options]

Options:
  --json                         Output diagnostic results as structured JSON
  -h, --help                     Show this help message

Description:
  Checks OS version, kernel release, write permissions in the working directory,
  and verifies availability of core tools (bun, node, npm, git, brew, apt-get).

Examples:
  dotts doctor
  dotts doctor --json`;

export const SECRETS_HELP = `dotts secrets - Manage encrypted credentials and tokens in .dotts/vault

Usage:
  dotts secrets <action> [arguments] [options]

Commands:
  get <name>                     Retrieve a secret value from the vault
  set <name> <value>             Store an encrypted secret in the vault
  list [--json]                  List all secret names stored in the vault
  remove <name>                  Delete a secret from the vault

Options:
  -h, --help                     Show this help message

Description:
  Secrets are encrypted with AES-256-GCM using the key in ~/.dotts_key,
  ~/.dotts-key, ~/.vault-pass, or the DOTTS_KEY environment variable.

Examples:
  dotts secrets list
  dotts secrets list --json
  dotts secrets get ssh_private_key
  dotts secrets set API_KEY "secret-value"
  dotts secrets remove API_KEY

Run 'dotts secrets <action> --help' for details on a specific action.`;

export const SECRETS_GET_HELP = `dotts secrets get - Retrieve a secret value from the vault

Usage:
  dotts secrets get <name>

Arguments:
  name                           Name of the secret to retrieve

Options:
  -h, --help                     Show this help message

Examples:
  dotts secrets get ssh_private_key`;

export const SECRETS_SET_HELP = `dotts secrets set - Store an encrypted secret in the vault

Usage:
  dotts secrets set <name> <value>

Arguments:
  name                           Name of the secret
  value                          Secret value to encrypt and store

Options:
  -h, --help                     Show this help message

Examples:
  dotts secrets set GH_TOKEN "ghp_xxxx"
  dotts secrets set API_KEY "sk-xxxx"`;

export const SECRETS_LIST_HELP = `dotts secrets list - List all secret names stored in the vault

Usage:
  dotts secrets list [options]

Options:
  --json                         Output secret names as structured JSON
  -h, --help                     Show this help message

Examples:
  dotts secrets list
  dotts secrets list --json`;

export const SECRETS_REMOVE_HELP = `dotts secrets remove - Delete a secret from the vault

Usage:
  dotts secrets remove <name>

Arguments:
  name                           Name of the secret to delete

Options:
  -h, --help                     Show this help message

Examples:
  dotts secrets remove API_KEY`;

export function getHelpText(command?: string, subcommand?: string): string {
  if (!command) {
    return GLOBAL_HELP;
  }

  switch (command) {
    case "init":
      return INIT_HELP;
    case "prepare":
      return PREPARE_HELP;
    case "check":
      return CHECK_HELP;
    case "apply":
      return APPLY_HELP;
    case "doctor":
      return DOCTOR_HELP;
    case "secrets":
      if (subcommand) {
        switch (subcommand) {
          case "get":
            return SECRETS_GET_HELP;
          case "set":
            return SECRETS_SET_HELP;
          case "list":
            return SECRETS_LIST_HELP;
          case "remove":
            return SECRETS_REMOVE_HELP;
        }
      }
      return SECRETS_HELP;
    default:
      return GLOBAL_HELP;
  }
}

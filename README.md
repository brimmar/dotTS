# dotts

[![CI](https://github.com/brimmar/dotTS/actions/workflows/ci.yml/badge.svg)](https://github.com/brimmar/dotTS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**dotts** is a declarative dotfiles management tool written in TypeScript. Think of it as **AWS CDK for your local system**. It allows you to define your system configuration (packages, files, symlinks, directories, and scripts) using a familiar, type-safe DSL.

## Why dotts?

- **Type-Safe**: Use TypeScript to define your configuration with full autocomplete and linting.
- **Declarative**: Define *what* you want, not *how* to do it. dotts handles the state diffing and dependency management.
- **Dependency Graph**: Resources can depend on each other, ensuring correct execution order.
- **Parallel Execution**: Independent resources are applied concurrently for maximum speed.
- **Secret Management**: Built-in support for managing secrets safely.
- **Platform Aware**: Easily handle different OSs and distributions.

---

## Quick Start

### 1. Install dotts

You can install dotts using our one-liner script:

```bash
curl -fsSL https://github.com/brimmar/dotTS/raw/main/scripts/install.sh | bash
```

Alternatively, if you have [Bun](https://bun.sh) installed:

```bash
bun install -g dotts
```

### 2. Create your configuration

Create a `dotts.ts` file in your dotfiles repository:

```typescript
import { pkg, link, file, dir, script, onPlatform } from 'dotts';

export default () => {
  // Install packages
  pkg('zsh');
  pkg('git');
  
  // Create directories
  dir('~/.config/nvim');
  
  // Symlink dotfiles
  link('~/.zshrc', './zshrc');
  
  // Conditional configuration
  onPlatform('darwin', () => {
    pkg('iterm2', { manager: 'brew' });
  });
  
  onPlatform('linux', () => {
    pkg('build-essential');
  });

  // Run custom scripts
  script('chsh -s $(which zsh)', {
    unless: 'echo $SHELL | grep -q zsh'
  });
};
```

### 3. Apply the configuration

```bash
dotts apply dotts.ts
```

---

## API Reference

### Resource Types

#### `pkg(name: string, props?: PackageResourceProps)`
Installs a system package.
- `manager`: 'apt', 'brew', 'pacman', 'dnf', etc. (automatically detected if omitted)
- `state`: 'present' | 'absent' (default: 'present')

#### `file(path: string, props: FileResourceProps)`
Manages a file's content and permissions.
- `content`: string or `Template`
- `mode`: file permissions (e.g., `0o644`)
- `owner`, `group`: file ownership

#### `link(path: string, source: string)`
Creates a symbolic link.
- `path`: where the link will be created.
- `source`: the target of the link.

#### `dir(path: string, props?: DirectoryResourceProps)`
Ensures a directory exists.
- `mode`: directory permissions.

#### `script(run: string, props?: ScriptResourceProps)`
Runs a shell command.
- `unless`: a command that, if it succeeds (exit code 0), skips the execution.
- `cwd`: the working directory.

#### `remoteFile(path: string, props: RemoteFileResourceProps)`
Downloads a file from a URL.
- `url`: the source URL.

### Helpers

#### `onPlatform(os: OS | OS[], callback: () => void)`
Runs the callback only if the current OS matches.
- `os`: 'darwin', 'linux', 'win32', etc.

#### `onDistro(distro: Distro | Distro[], callback: () => void)`
Runs the callback only if the current distribution matches.
- `distro`: 'ubuntu', 'arch', 'fedora', etc.

#### `secret(name: string)`
Retrieves a secret from the secret manager.

---

## Project Structure Example

```text
my-dotfiles/
├── dotts.ts          # Main configuration
├── zshrc             # Source file for .zshrc
├── nvim/             # Source directory for nvim config
└── scripts/
    └── post-install.sh
```

---

## Comparison

| Feature | dotts | Ansible | Nix |
| :--- | :--- | :--- | :--- |
| Language | TypeScript | YAML | Nix |
| Typing | Strong | Weak | Strong |
| Learning Curve | Low (for devs) | Medium | High |
| Execution | Parallel | Sequential/Parallel | Atomic/Functional |

---

## License

MIT © [brimmar](https://github.com/brimmar)

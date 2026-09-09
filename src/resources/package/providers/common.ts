import { Effect } from 'effect';
import type { PackageProvider } from '../provider';
import { SystemCommand } from '../../../services/exec';
import * as p from '@clack/prompts';

function checkWithWhich(name: string) {
  return Effect.gen(function* () {
    const exec = yield* SystemCommand;
    return yield* Effect.match(
      exec.execFile('which', [name]),
      {
        onFailure: () => false,
        onSuccess: () => true,
      }
    );
  });
}

export class BrewProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.execFile('brew', ['install', pkg], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('brew', ['uninstall', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('brew', ['list', '--versions', name]),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output) return false;
      if (version) return output.includes(version);
      return true;
    });
  }
}

export class AptProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}=${version}` : name;
      yield* exec.execFile('apt-get', ['install', '-y', pkg], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('apt-get', ['remove', '-y', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('dpkg', ['-s', name]),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output) return false;
      if (version) return output.includes(`Version: ${version}`);
      return true;
    });
  }
}

export class PacmanProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      if (version) {
         p.log.warn(`Pacman provider does not support specific versions easily. Installing latest ${name}.`);
      }
      yield* exec.execFile('pacman', ['-S', '--noconfirm', name], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('pacman', ['-Rs', '--noconfirm', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('pacman', ['-Qi', name]),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output) return false;
      if (version) return output.includes(`Version         : ${version}`);
      return true;
    });
  }
}

export class BunProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.execFile('bun', ['add', '-g', pkg], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('bun', ['remove', '-g', name], { become: options?.become });
    });
  }
  isInstalled(name: string, _version?: string) {
    return checkWithWhich(name);
  }
}

export class NpmProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.execFile('npm', ['install', '-g', pkg], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('npm', ['uninstall', '-g', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('npm', ['list', '-g', name]),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output || output.includes('(empty)')) return false;
      if (version) return output.includes(`${name}@${version}`);
      return true;
    });
  }
}

export class CargoProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const args = version ? ['install', name, '--version', version] : ['install', name];
      yield* exec.execFile('cargo', args, { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('cargo', ['uninstall', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('cargo', ['install', '--list']),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output) return false;
      const regex = version 
        ? new RegExp(`^${name} v${version}:`, 'm')
        : new RegExp(`^${name} v`, 'm');
      return regex.test(output);
    });
  }
}

export class PipProvider implements PackageProvider {
  install(name: string, version?: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}==${version}` : name;
      yield* exec.execFile('pip', ['install', pkg], { become: options?.become });
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('pip', ['uninstall', '-y', name], { become: options?.become });
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.execFile('pip', ['show', name]),
        {
          onFailure: () => '',
          onSuccess: (out) => out,
        }
      );
      if (!output) return false;
      if (version) return output.includes(`Version: ${version}`);
      return true;
    });
  }
}

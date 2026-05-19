import { Effect } from 'effect';
import type { PackageProvider } from '../provider';
import { SystemCommand } from '../../../services/exec';
import * as p from '@clack/prompts';

function checkWithWhich(name: string) {
  return Effect.gen(function* () {
    const exec = yield* SystemCommand;
    return yield* Effect.match(
      exec.run(`which ${name}`),
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
      yield* exec.run(`brew install ${pkg}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`brew uninstall ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`brew list --versions ${name}`),
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
      yield* exec.run(`apt install -y ${pkg}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`apt-get remove -y ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`dpkg -s ${name}`),
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
      yield* exec.run(`pacman -S --noconfirm ${name}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`pacman -Rs --noconfirm ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`pacman -Qi ${name}`),
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
      yield* exec.run(`bun add -g ${pkg}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`bun remove -g ${name}`, options);
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
      yield* exec.run(`npm install -g ${pkg}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`npm uninstall -g ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`npm list -g ${name}`),
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
      const versionFlag = version ? `--version ${version}` : '';
      yield* exec.run(`cargo install ${name} ${versionFlag}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`cargo uninstall ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`cargo install --list`),
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
      yield* exec.run(`pip install ${pkg}`, options);
    });
  }
  uninstall(name: string, options?: { become?: boolean | string }) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`pip uninstall -y ${name}`, options);
    });
  }
  isInstalled(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* Effect.match(
        exec.run(`pip show ${name}`),
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
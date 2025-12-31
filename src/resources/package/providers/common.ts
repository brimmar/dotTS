import { Effect } from 'effect';
import { PackageProvider } from '../provider';
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.run(`brew install ${pkg}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`brew uninstall ${name}`);
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}=${version}` : name;
      yield* exec.run(`sudo apt install -y ${pkg}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo apt-get remove -y ${name}`);
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      if (version) {
         p.log.warn(`Pacman provider does not support specific versions easily. Installing latest ${name}.`);
      }
      yield* exec.run(`sudo pacman -S --noconfirm ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo pacman -Rs --noconfirm ${name}`);
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.run(`bun add -g ${pkg}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`bun remove -g ${name}`);
    });
  }
  isInstalled(name: string, _version?: string) {
    return checkWithWhich(name);
  }
}

export class NpmProvider implements PackageProvider {
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}@${version}` : name;
      yield* exec.run(`npm install -g ${pkg}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`npm uninstall -g ${name}`);
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const versionFlag = version ? `--version ${version}` : '';
      yield* exec.run(`cargo install ${name} ${versionFlag}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`cargo uninstall ${name}`);
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
  install(name: string, version?: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const pkg = version ? `${name}==${version}` : name;
      yield* exec.run(`pip install ${pkg}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`pip uninstall -y ${name}`);
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
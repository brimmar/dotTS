import { Effect } from 'effect';
import { PackageProvider } from '../provider';
import { SystemCommand } from '../../../services/exec';

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
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`brew install ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`brew uninstall ${name}`);
    });
  }
  isInstalled(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* Effect.match(
        exec.run(`brew list --versions ${name}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
    });
  }
}

export class AptProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo apt install -y ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo apt-get remove -y ${name}`);
    });
  }
  isInstalled(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* Effect.match(
        exec.run(`dpkg -s ${name}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
    });
  }
}

export class PacmanProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo pacman -S --noconfirm ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`sudo pacman -Rs --noconfirm ${name}`);
    });
  }
  isInstalled(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* Effect.match(
        exec.run(`pacman -Qi ${name}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
    });
  }
}

export class BunProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`bun add -g ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`bun remove -g ${name}`);
    });
  }
  isInstalled(name: string) {
    return checkWithWhich(name);
  }
}

export class NpmProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`npm install -g ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`npm uninstall -g ${name}`);
    });
  }
  isInstalled(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* Effect.match(
        exec.run(`npm list -g ${name}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
    });
  }
}

export class CargoProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`cargo install ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`cargo uninstall ${name}`);
    });
  }
  isInstalled(name: string) {
    return checkWithWhich(name);
  }
}

export class PipProvider implements PackageProvider {
  install(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`pip install ${name}`);
    });
  }
  uninstall(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`pip uninstall -y ${name}`);
    });
  }
  isInstalled(name: string) {
    return Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* Effect.match(
        exec.run(`pip show ${name}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
    });
  }
}
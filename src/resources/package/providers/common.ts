import { Effect } from 'effect';
import { PackageProvider } from '../provider';
import { SystemCommand } from '../../../services/exec';

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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
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
  isInstalled(_name: string) {
    return Effect.succeed(false);
  }
}

import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';
import { hashConfig } from '../core/hash';

export interface PackageResourceProps {
  name: string;
  manager?: 'brew' | 'apt' | 'npm' | 'pacman' | 'bun';
}

export class PackageResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: PackageResourceProps) {
    super(scope, id);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const platform = yield* PlatformService;
      
      const manager = yield* this.resolveManager(platform);
      const command = this.getInstallCommand(manager);
      yield* exec.run(command);
    });
  }

  destroy() {
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const platform = yield* PlatformService;
      
      const manager = yield* this.resolveManager(platform);
      const command = this.getUninstallCommand(manager);
      yield* exec.run(command);
    });
  }

  private resolveManager(platform: PlatformService): Effect.Effect<'brew' | 'apt' | 'npm' | 'pacman' | 'bun', Error> {
    if (this.props.manager) {
      return Effect.succeed(this.props.manager);
    }

    return Effect.gen(function* () {
      const info = yield* platform.get();
      if (info.os === 'darwin') return 'brew';
      if (info.os === 'linux') {
        if (info.distro === 'ubuntu' || info.distro === 'debian') return 'apt';
        if (info.distro === 'arch') return 'pacman';
      }
      throw new Error(`Could not infer package manager for platform: ${info.os} ${info.distro || ''}`);
    });
  }

  private getInstallCommand(manager: string): string {
    switch (manager) {
      case 'brew':
        return `brew install ${this.props.name}`;
      case 'apt':
        return `sudo apt install -y ${this.props.name}`;
      case 'pacman':
        return `sudo pacman -S --noconfirm ${this.props.name}`;
      case 'bun':
        return `bun add -g ${this.props.name}`;
      case 'npm':
        return `npm install -g ${this.props.name}`;
      default:
        throw new Error(`Unsupported package manager: ${manager}`);
    }
  }

  private getUninstallCommand(manager: string): string {
    switch (manager) {
      case 'brew':
        return `brew uninstall ${this.props.name}`;
      case 'apt':
        return `sudo apt-get remove -y ${this.props.name}`;
      case 'pacman':
        return `sudo pacman -Rs --noconfirm ${this.props.name}`;
      case 'bun':
        return `bun remove -g ${this.props.name}`;
      case 'npm':
        return `npm uninstall -g ${this.props.name}`;
      default:
        throw new Error(`Unsupported package manager: ${manager}`);
    }
  }
}

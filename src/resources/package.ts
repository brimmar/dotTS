import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';
import { hashConfig } from '../core/hash';
import type { PackageProvider } from './package/provider';
import { BrewProvider, AptProvider, PacmanProvider, BunProvider, NpmProvider, CargoProvider, PipProvider } from './package/providers/common';

export type PackageManager = 'brew' | 'apt' | 'npm' | 'pacman' | 'bun' | 'cargo' | 'pip';

export interface PackageResourceProps {
  name: string;
  manager?: PackageManager;
  version?: string;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class PackageResource extends Resource {
  override readonly kind = 'pkg' as const;
  constructor(scope: Component, id: string, override readonly props: PackageResourceProps) {
    super(scope, id, props);
  }

  override get concurrencyKey() {
    return `pkg-manager-${this.props.manager || 'system'}`;
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { name, version } = this.props;
    return Effect.gen(this, function* () {
      const platform = yield* PlatformService;
      const manager = yield* this.resolveManager(platform);
      const provider = this.getProvider(manager);
      
      const alreadyInstalled = yield* provider.isInstalled(name, version);
      if (alreadyInstalled) {
        return;
      }

      yield* provider.install(name, version, { become: this.props.become });
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const platform = yield* PlatformService;
      const manager = yield* this.resolveManager(platform);
      const provider = this.getProvider(manager);
      
      yield* provider.uninstall(name, { become: this.props.become });
    });
  }

  private resolveManager = (platform: PlatformService): Effect.Effect<PackageManager, Error> => {
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
  };

  private getProvider(manager: PackageManager): PackageProvider {
    switch (manager) {
      case 'brew': return new BrewProvider();
      case 'apt': return new AptProvider();
      case 'pacman': return new PacmanProvider();
      case 'bun': return new BunProvider();
      case 'npm': return new NpmProvider();
      case 'cargo': return new CargoProvider();
      case 'pip': return new PipProvider();
      default:
        throw new Error(`Unsupported package manager: ${manager}`);
    }
  }
}
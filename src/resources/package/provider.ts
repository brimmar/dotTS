import { Effect } from 'effect';

export interface PackageProvider {
  install(name: string): Effect.Effect<void, Error>;
  uninstall(name: string): Effect.Effect<void, Error>;
  isInstalled(name: string): Effect.Effect<boolean, Error>;
}

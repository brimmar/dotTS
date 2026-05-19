import { Effect } from 'effect';
import { SystemCommand } from '../../services/exec';

export interface PackageProvider {
  install(name: string, version?: string): Effect.Effect<void, Error, SystemCommand>;
  uninstall(name: string): Effect.Effect<void, Error, SystemCommand>;
  isInstalled(name: string, version?: string): Effect.Effect<boolean, Error, SystemCommand>;
}

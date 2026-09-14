import { Duration, Effect, Schedule } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { FileSystem } from '../services/fs';
import { HttpService } from '../services/http';
import { isDebianFamily, PlatformService } from '../services/platform';
import { hashConfig } from '../core/hash';
import { join } from 'node:path';

export interface AptRepositoryProps {
  name: string;
  uri: string;
  distribution: string;
  components: string[];
  key?: string; // URL to the GPG key
  state?: 'present' | 'absent';
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export const APT_UPDATE_ARGS = [
  'update',
  '-o',
  'Acquire::Check-Valid-Until=false',
  '-o',
  'Acquire::Max-FutureTime=86400',
];

export class AptRepositoryResource extends Resource {
  override readonly kind = 'apt-repo' as const;
  constructor(scope: Component, id: string, override readonly props: AptRepositoryProps) {
    super(scope, id, props);
  }

  override get concurrencyKey(): string {
    return 'pkg-manager-system';
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { name, uri, distribution, components, key, state = 'present' } = this.props;
    const keyringPath = `/etc/apt/keyrings/${name}.gpg`;
    const listPath = `/etc/apt/sources.list.d/${name}.list`;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const fs = yield* FileSystem;
      const http = yield* HttpService;
      const platform = yield* PlatformService;
      const info = yield* platform.get();
      const become = this.props.become === false ? undefined : (this.props.become ?? true);

      if (info.os !== 'linux' || !isDebianFamily(info)) {
        throw new Error(`aptRepository resource is only supported on Debian-based systems. Current: ${info.os} ${info.distro}`);
      }

      if (state === 'present') {
        let changed = false;

        // 1. Handle GPG Key
        if (key) {
          const keyExists = yield* fs.exists(keyringPath);
          let keyValid = false;
          if (keyExists) {
            const check = yield* Effect.match(
              exec.execFile('gpg', ['--show-keys', keyringPath], { intent: 'read' }),
              {
                onFailure: () => false,
                onSuccess: () => true,
              },
            );
            keyValid = check;
          }

          if (!keyExists || !keyValid) {
            if (keyExists) {
              yield* fs.rm(keyringPath, { become });
            }
            yield* fs.mkdir('/etc/apt/keyrings', { become });
            // Download key as raw bytes to prevent UTF-8 corruption of binary OpenPGP keyrings
            const tempKeyPath = `/tmp/dotts-${name}.key`;
            const keyBytes = yield* http.downloadBytes(key);
            yield* fs.writeFileBytes(tempKeyPath, keyBytes);

            // Check if it needs dearmoring (ASCII armored starts with -----BEGIN PGP PUBLIC KEY BLOCK-----)
            const textSample = new TextDecoder('utf-8', { fatal: false }).decode(keyBytes.slice(0, 128));
            const isArmored = textSample.includes('-----BEGIN PGP');

            if (isArmored) {
              yield* exec.execFile('gpg', ['--dearmor', '--output', keyringPath, tempKeyPath], { become });
            } else {
              yield* exec.execFile('cp', [tempKeyPath, keyringPath], { become });
            }
            yield* fs.rm(tempKeyPath);
            changed = true;
          }
        }

        // 2. Handle .list file
        const signedBy = key ? ` [signed-by=${keyringPath}]` : '';
        const line = `deb${signedBy} ${uri} ${distribution} ${components.join(' ')}`;
        
        const listExists = yield* fs.exists(listPath);
        const currentContent = listExists ? (yield* fs.readFile(listPath)).trim() : '';

        if (currentContent !== line) {
          yield* fs.writeFile(listPath, line + '\n', { become });
          changed = true;
        }

        // 3. Update apt
        if (changed) {
          yield* sanitizeBrokenAptSources(fs, exec, become);
          yield* Effect.retry(
            exec.execFile('apt-get', APT_UPDATE_ARGS, { become }),
            Schedule.recurs(5).pipe(Schedule.addDelay(() => Duration.seconds(3))),
          );
        }
      } else {
        // state === 'absent'
        let removed = false;
        if (yield* fs.exists(listPath)) {
          yield* fs.rm(listPath, { become });
          removed = true;
        }
        if (yield* fs.exists(keyringPath)) {
          yield* fs.rm(keyringPath, { become });
          removed = true;
        }
        if (removed) {
          yield* sanitizeBrokenAptSources(fs, exec, become);
          yield* Effect.retry(
            exec.execFile('apt-get', APT_UPDATE_ARGS, { become }),
            Schedule.recurs(5).pipe(Schedule.addDelay(() => Duration.seconds(3))),
          );
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    const keyringPath = `/etc/apt/keyrings/${name}.gpg`;
    const listPath = `/etc/apt/sources.list.d/${name}.list`;
    const become = this.props.become === false ? undefined : (this.props.become ?? true);

    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      const exec = yield* SystemCommand;
      yield* fs.rm(listPath, { become });
      yield* fs.rm(keyringPath, { become });
      yield* sanitizeBrokenAptSources(fs, exec, become);
      yield* Effect.retry(
        exec.execFile('apt-get', APT_UPDATE_ARGS, { become }),
        Schedule.recurs(5).pipe(Schedule.addDelay(() => Duration.seconds(3))),
      );
    });
  }
}

function sanitizeBrokenAptSources(
  fs: FileSystem,
  exec: SystemCommand,
  become?: boolean | string,
) {
  return Effect.gen(function* () {
    const sourcesDir = '/etc/apt/sources.list.d';
    const exists = yield* fs.exists(sourcesDir);
    if (!exists) return;

    const result = yield* Effect.match(
      exec.execFile('find', [sourcesDir, '-maxdepth', '1', '-name', '*.list'], { intent: 'read' }),
      {
        onFailure: () => '',
        onSuccess: (out) => out,
      },
    );

    const listFiles = result.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const file of listFiles) {
      const content = yield* Effect.match(
        fs.readFile(file),
        {
          onFailure: () => '',
          onSuccess: (c) => c,
        },
      );

      const match = content.match(/signed-by=([^\s\]]+)/);
      if (match && match[1]) {
        const keyring = match[1];
        const keyringExists = yield* fs.exists(keyring);
        let keyringValid = false;
        if (keyringExists) {
          keyringValid = yield* Effect.match(
            exec.execFile('gpg', ['--show-keys', keyring], { intent: 'read' }),
            {
              onFailure: () => false,
              onSuccess: () => true,
            },
          );
        }

        if (!keyringExists || !keyringValid) {
          yield* fs.rm(file, { become });
        }
      }
    }
  });
}

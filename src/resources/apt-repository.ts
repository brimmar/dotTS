import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { FileSystem } from '../services/fs';
import { HttpService } from '../services/http';
import { PlatformService } from '../services/platform';
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
}

export class AptRepositoryResource extends Resource {
  constructor(scope: Component, id: string, override readonly props: AptRepositoryProps) {
    super(scope, id, props);
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

      if (info.os !== 'linux' || (info.distro !== 'ubuntu' && info.distro !== 'debian')) {
        throw new Error(`aptRepository resource is only supported on Debian-based systems. Current: ${info.os} ${info.distro}`);
      }

      if (state === 'present') {
        let changed = false;

        // 1. Handle GPG Key
        if (key) {
          const keyExists = yield* fs.exists(keyringPath);
          if (!keyExists) {
            yield* fs.mkdir('/etc/apt/keyrings');
            // Download key. We use a temporary file to dearmor it.
            const tempKeyPath = `/tmp/dotts-${name}.key`;
            const keyContent = yield* http.downloadString(key);
            yield* fs.writeFile(tempKeyPath, keyContent);
            
            // Check if it needs dearmoring (ASCII armored starts with -----BEGIN PGP PUBLIC KEY BLOCK-----)
            if (keyContent.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
              yield* exec.run(`gpg --dearmor < ${tempKeyPath} > ${keyringPath}`, { become: this.props.become });
            } else {
              yield* exec.run(`cp ${tempKeyPath} ${keyringPath}`, { become: this.props.become });
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
          yield* fs.writeFile(listPath, line + '\n');
          changed = true;
        }

        // 3. Update apt
        if (changed) {
          yield* exec.run(`apt-get update`, { become: this.props.become });
        }
      } else {
        // state === 'absent'
        let removed = false;
        if (yield* fs.exists(listPath)) {
          yield* fs.rm(listPath);
          removed = true;
        }
        if (yield* fs.exists(keyringPath)) {
          yield* fs.rm(keyringPath);
          removed = true;
        }
        if (removed) {
          yield* exec.run(`apt-get update`, { become: this.props.become });
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    const keyringPath = `/etc/apt/keyrings/${name}.gpg`;
    const listPath = `/etc/apt/sources.list.d/${name}.list`;

    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      const exec = yield* SystemCommand;
      yield* fs.rm(listPath);
      yield* fs.rm(keyringPath);
      yield* exec.run(`apt-get update`, { become: this.props.become });
    });
  }
}

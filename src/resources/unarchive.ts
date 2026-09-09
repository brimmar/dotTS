import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface UnarchiveResourceProps {
  src: string;
  dest: string;
  stripComponents?: number;
  mode?: number;
  uid?: number;
  gid?: number;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class UnarchiveResource extends Resource {
  override readonly kind = 'unarchive' as const;
  constructor(scope: Component, id: string, override readonly props: UnarchiveResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      const exec = yield* SystemCommand;

      const { src, dest, stripComponents = 0, become } = this.props;

      // Ensure destination exists
      yield* fs.mkdir(dest, { become });

      if (src.endsWith('.zip')) {
        yield* exec.run(`unzip -o ${src} -d ${dest}`, { become });
      } else if (
        src.endsWith('.tar') ||
        src.endsWith('.tar.gz') ||
        src.endsWith('.tgz') ||
        src.endsWith('.tar.xz') ||
        src.endsWith('.tar.bz2')
      ) {
        let flags = '-x';
        if (src.endsWith('.tar.gz') || src.endsWith('.tgz')) flags += 'z';
        else if (src.endsWith('.tar.xz')) flags += 'J';
        else if (src.endsWith('.tar.bz2')) flags += 'j';
        
        flags += 'f';

        const stripCmd = stripComponents > 0 ? `--strip-components=${stripComponents}` : '';
        yield* exec.run(`tar ${flags} ${src} -C ${dest} ${stripCmd}`, { become });
      } else {
        throw new Error(`Unsupported archive format: ${src}`);
      }

      // Apply ownership and mode if specified
      if (this.props.mode !== undefined) {
        yield* fs.chmod(dest, this.props.mode, { become });
      }

      if (this.props.uid !== undefined || this.props.gid !== undefined) {
        const uid = this.props.uid ?? process.getuid!();
        const gid = this.props.gid ?? process.getgid!();
        yield* fs.chown(dest, uid, gid, { become });
      }
    });
  }

  destroy() {
    return Effect.void;
  }
}

import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';

export interface DirectoryResourceProps {
  path: string;
  mode?: number;
  uid?: number;
  gid?: number;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class DirectoryResource extends Resource {
  override readonly kind = 'dir' as const;
  constructor(scope: Component, id: string, override readonly props: DirectoryResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      
      yield* fs.mkdir(this.props.path, { become: this.props.become });

      if (this.props.mode !== undefined) {
        yield* fs.chmod(this.props.path, this.props.mode, { become: this.props.become });
      }

      if (this.props.uid !== undefined || this.props.gid !== undefined) {
        const uid = this.props.uid ?? process.getuid!();
        const gid = this.props.gid ?? process.getgid!();
        yield* fs.chown(this.props.path, uid, gid, { become: this.props.become });
      }
    });
  }

  destroy() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      yield* fs.rmdir(this.props.path, { become: this.props.become });
    });
  }
}

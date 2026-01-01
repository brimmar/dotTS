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
}

export class DirectoryResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: DirectoryResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      
      yield* fs.mkdir(this.props.path);

      if (this.props.mode !== undefined) {
        yield* fs.chmod(this.props.path, this.props.mode);
      }

      if (this.props.uid !== undefined || this.props.gid !== undefined) {
        const uid = this.props.uid ?? process.getuid!();
        const gid = this.props.gid ?? process.getgid!();
        yield* fs.chown(this.props.path, uid, gid);
      }
    });
  }

  destroy() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      yield* fs.rm(this.props.path);
    });
  }
}

import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';

export interface SymlinkResourceProps {
  source: string;
  path: string;
}

export class SymlinkResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: SymlinkResourceProps) {
    super(scope, id);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.symlink(this.props.source, this.props.path));
    });
  }
}

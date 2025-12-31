import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { dirname } from 'node:path';

export interface FileResourceProps {
  path: string;
  content: string;
}

export class FileResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: FileResourceProps) {
    super(scope, id);
  }

  apply() {
    return Effect.gen(this, function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(dirname(this.props.path)));
      yield* _(fs.writeFile(this.props.path, this.props.content));
    });
  }
}

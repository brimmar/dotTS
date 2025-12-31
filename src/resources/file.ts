import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { dirname } from 'node:path';
import { SecretToken } from '../core/secret';
import { SecretManager } from '../services/secrets-manager';
import { hashConfig } from '../core/hash';

export interface FileResourceProps {
  path: string;
  content: string | SecretToken;
}

export class FileResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: FileResourceProps) {
    super(scope, id);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* (_) {
      const fs = yield* _(FileSystem);
      const sm = yield* _(SecretManager);
      
      let content: string;
      if (this.props.content instanceof SecretToken) {
        content = yield* _(sm.get(this.props.content.name));
      } else {
        content = this.props.content;
      }

      yield* _(fs.mkdir(dirname(this.props.path)));
      yield* _(fs.writeFile(this.props.path, content));
    });
  }
}

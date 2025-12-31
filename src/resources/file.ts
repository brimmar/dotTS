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
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      const sm = yield* SecretManager;
      
      let content: string;
      if (this.props.content instanceof SecretToken) {
        content = yield* sm.get(this.props.content.name);
      } else {
        content = this.props.content;
      }

      yield* fs.mkdir(dirname(this.props.path));
      yield* fs.writeFile(this.props.path, content);
    });
  }

  destroy() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      yield* fs.rm(this.props.path);
    });
  }
}
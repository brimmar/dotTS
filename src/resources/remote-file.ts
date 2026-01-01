import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { HttpService } from '../services/http';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';

export interface RemoteFileResourceProps {
  url: string;
  path: string;
  sha256?: string;
  mode?: number;
  owner?: string;
  group?: string;
  dependsOn?: Component[];
}

export class RemoteFileResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: RemoteFileResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const http = yield* HttpService;
      const fs = yield* FileSystem;

      const content = yield* http.downloadString(this.props.url);
      yield* fs.writeFile(this.props.path, content);
      
      if (this.props.mode !== undefined) {
        yield* fs.chmod(this.props.path, this.props.mode);
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

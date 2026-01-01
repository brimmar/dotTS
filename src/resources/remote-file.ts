import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { HttpService } from '../services/http';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

export interface RemoteFileResourceProps {
  url: string;
  path: string;
  sha256?: string;
  mode?: number;
  uid?: number;
  gid?: number;
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

      // For now, we use a simple hash of the URL and Path to store Etag in metadata
      // Actually, we can use the state metadata to store the Etag.
      // But the Runner doesn't pass the old metadata here yet easily without changes.
      // We will skip Etag for this task to avoid breaking the Runner's current interface.
      // We will focus on progress reporting if possible, but Bun's fetch doesn't easily support it without streaming.

      const content = yield* http.downloadString(this.props.url);
      
      if (this.props.sha256) {
        const actualHash = createHash('sha256').update(content).digest('hex');
        if (actualHash !== this.props.sha256) {
          throw new Error(`Hash mismatch for ${this.props.url}. Expected ${this.props.sha256}, got ${actualHash}`);
        }
      }

      yield* fs.mkdir(dirname(this.props.path));
      yield* fs.writeFile(this.props.path, content);
      
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
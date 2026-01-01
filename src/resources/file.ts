import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { FileSystem } from '../services/fs';
import { dirname } from 'node:path';
import { SecretToken } from '../core/secret';
import { SecretManager } from '../services/secrets-manager';
import { TemplateService } from '../services/template';
import { hashConfig } from '../core/hash';

export interface FileResourceProps {
  path: string;
  content: string | SecretToken;
  vars?: Record<string, any>;
  mode?: number;
  uid?: number;
  gid?: number;
  dependsOn?: Component[];
}

export class FileResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: FileResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      const sm = yield* SecretManager;
      const tpl = yield* TemplateService;
      
      let content: string;
      if (this.props.content instanceof SecretToken) {
        content = yield* sm.get(this.props.content.name);
      } else {
        content = this.props.content;
      }

      if (this.props.vars) {
        content = yield* tpl.render(content, this.props.vars);
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
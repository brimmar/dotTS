import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { FileSystem } from '../services/fs';
import { hashConfig } from '../core/hash';

export interface GitResourceProps {
  url: string;
  dest: string;
  branch?: string;
  sparse?: string[];
  depth?: number;
  recursive?: boolean;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class GitResource extends Resource {
  constructor(scope: Component, id: string, override readonly props: GitResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { url, dest, branch, sparse, depth, recursive } = this.props;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const fs = yield* FileSystem;

      const exists = yield* fs.exists(dest);
      const isGit = exists && (yield* fs.exists(`${dest}/.git`));

      const become = this.props.become;
      const inRepo = { cwd: dest, become };

      if (!isGit) {
        const cloneArgs = ['clone'];
        if (depth) cloneArgs.push('--depth', String(depth));
        if (branch) cloneArgs.push('--branch', branch);
        if (recursive) cloneArgs.push('--recursive');
        if (sparse) cloneArgs.push('--no-checkout');
        cloneArgs.push(url, dest);
        yield* exec.execFile('git', cloneArgs, { become });

        if (sparse) {
          yield* exec.execFile('git', ['sparse-checkout', 'init', '--cone'], inRepo);
          yield* exec.execFile('git', ['sparse-checkout', 'set', ...sparse], inRepo);
          yield* exec.execFile('git', ['checkout', branch || 'HEAD'], inRepo);
        }
      } else {
        const currentUrl = yield* exec.execFile('git', ['remote', 'get-url', 'origin'], inRepo);
        if (currentUrl !== url) {
          throw new Error(`Git destination ${dest} exists but points to ${currentUrl} instead of ${url}`);
        }

        if (branch) {
          yield* exec.execFile('git', ['checkout', branch], inRepo);
        }

        if (sparse) {
          yield* exec.execFile('git', ['sparse-checkout', 'set', ...sparse], inRepo);
        }

        yield* exec.execFile('git', ['pull'], inRepo);
        if (recursive) {
          yield* exec.execFile('git', ['submodule', 'update', '--init', '--recursive'], inRepo);
        }
      }
    });
  }

  destroy() {
    return Effect.gen(this, function* () {
      const fs = yield* FileSystem;
      yield* fs.rm(this.props.dest);
    });
  }
}

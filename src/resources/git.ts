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

      if (!isGit) {
        // Clone
        let cloneCmd = `git clone`;
        if (depth) cloneCmd += ` --depth ${depth}`;
        if (branch) cloneCmd += ` --branch ${branch}`;
        if (recursive) cloneCmd += ` --recursive`;
        if (sparse) cloneCmd += ` --no-checkout`;
        
        cloneCmd += ` ${url} ${dest}`;
        yield* exec.run(cloneCmd);

        if (sparse) {
          yield* exec.run(`git sparse-checkout init --cone`, { cwd: dest });
          yield* exec.run(`git sparse-checkout set ${sparse.join(' ')}`, { cwd: dest });
          yield* exec.run(`git checkout ${branch || 'HEAD'}`, { cwd: dest });
        }
      } else {
        // Update
        // Verify origin URL
        const currentUrl = yield* exec.run(`git remote get-url origin`, { cwd: dest });
        if (currentUrl !== url) {
          throw new Error(`Git destination ${dest} exists but points to ${currentUrl} instead of ${url}`);
        }

        if (branch) {
          yield* exec.run(`git checkout ${branch}`, { cwd: dest });
        }

        if (sparse) {
          yield* exec.run(`git sparse-checkout set ${sparse.join(' ')}`, { cwd: dest });
        }

        yield* exec.run(`git pull`, { cwd: dest });
        if (recursive) {
          yield* exec.run(`git submodule update --init --recursive`, { cwd: dest });
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

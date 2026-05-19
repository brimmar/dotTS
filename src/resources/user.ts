import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';

export interface UserProps {
  name: string;
  uid?: number;
  gid?: number | string;
  groups?: string[];
  shell?: string;
  home?: string;
  createHome?: boolean;
  state?: 'present' | 'absent';
  dependsOn?: Component[];
}

export class UserResource extends Resource {
  constructor(scope: Component, id: string, override readonly props: UserProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { name, uid, gid, groups, shell, home, createHome = true, state = 'present' } = this.props;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;

      const exists = yield* this.checkExists(name, exec);

      if (state === 'present') {
        if (!exists) {
          let cmd = `useradd`;
          if (uid !== undefined) cmd += ` --uid ${uid}`;
          if (gid !== undefined) cmd += ` --gid ${gid}`;
          if (groups && groups.length > 0) cmd += ` --groups ${groups.join(',')}`;
          if (shell) cmd += ` --shell ${shell}`;
          if (home) cmd += ` --home-dir ${home}`;
          if (createHome) cmd += ` --create-home`;
          cmd += ` ${name}`;
          yield* exec.run(cmd, { become: this.props.become });
        } else {
          // Update existing user
          let cmd = `usermod`;
          let needsUpdate = false;

          if (uid !== undefined) {
            const currentUid = yield* exec.run(`id -u ${name}`, { become: this.props.become });
            if (parseInt(currentUid) !== uid) {
              cmd += ` --uid ${uid}`;
              needsUpdate = true;
            }
          }

          if (gid !== undefined) {
            const currentGid = yield* exec.run(`id -g ${name}`, { become: this.props.become });
            // This is simplified, gid could be name or id
            if (currentGid !== String(gid)) {
              cmd += ` --gid ${gid}`;
              needsUpdate = true;
            }
          }

          if (groups) {
            const currentGroups = (yield* exec.run(`id -Gn ${name}`, { become: this.props.become })).split(' ');
            const hasAllGroups = groups.every(g => currentGroups.includes(g));
            if (!hasAllGroups) {
              cmd += ` --groups ${groups.join(',')}`;
              needsUpdate = true;
            }
          }

          if (shell) {
            const currentShell = yield* exec.run(`getent passwd ${name} | cut -d: -f7`, { become: this.props.become });
            if (currentShell !== shell) {
              cmd += ` --shell ${shell}`;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            cmd += ` ${name}`;
            yield* exec.run(cmd, { become: this.props.become });
          }
        }
      } else {
        if (exists) {
          yield* exec.run(`userdel --remove ${name}`, { become: this.props.become });
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`userdel --remove ${name}`, { become: this.props.become });
    });
  }

  private checkExists(name: string, exec: SystemCommand): Effect.Effect<boolean, Error> {
    return exec.run(`id ${name}`, { become: this.props.become }).pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false))
    );
  }
}

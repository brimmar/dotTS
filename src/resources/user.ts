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
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
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
          const args: string[] = [];
          if (uid !== undefined) args.push('--uid', String(uid));
          if (gid !== undefined) args.push('--gid', String(gid));
          if (groups && groups.length > 0) args.push('--groups', groups.join(','));
          if (shell) args.push('--shell', shell);
          if (home) args.push('--home-dir', home);
          if (createHome) args.push('--create-home');
          args.push(name);
          yield* exec.execFile('useradd', args, { become: this.props.become });
        } else {
          // Update existing user
          const args: string[] = [];
          let needsUpdate = false;

          if (uid !== undefined) {
            const currentUid = yield* exec.execFile('id', ['-u', name], { become: this.props.become });
            if (parseInt(currentUid) !== uid) {
              args.push('--uid', String(uid));
              needsUpdate = true;
            }
          }

          if (gid !== undefined) {
            const currentGid = yield* exec.execFile('id', ['-g', name], { become: this.props.become });
            // This is simplified, gid could be name or id
            if (currentGid !== String(gid)) {
              args.push('--gid', String(gid));
              needsUpdate = true;
            }
          }

          if (groups) {
            const currentGroups = (yield* exec.execFile('id', ['-Gn', name], { become: this.props.become })).split(' ');
            const hasAllGroups = groups.every(g => currentGroups.includes(g));
            if (!hasAllGroups) {
              args.push('--groups', groups.join(','));
              needsUpdate = true;
            }
          }

          if (shell) {
            const passwd = yield* exec.execFile('getent', ['passwd', name], { become: this.props.become });
            const currentShell = passwd.split(':')[6];
            if (currentShell !== shell) {
              args.push('--shell', shell);
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            args.push(name);
            yield* exec.execFile('usermod', args, { become: this.props.become });
          }
        }
      } else {
        if (exists) {
          yield* exec.execFile('userdel', ['--remove', name], { become: this.props.become });
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('userdel', ['--remove', name], { become: this.props.become });
    });
  }

  private checkExists(name: string, exec: SystemCommand): Effect.Effect<boolean, Error> {
    return exec.execFile('id', [name], { become: this.props.become, intent: 'read' }).pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false))
    );
  }
}

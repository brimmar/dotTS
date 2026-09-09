import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';

export interface GroupProps {
  name: string;
  gid?: number;
  state?: 'present' | 'absent';
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class GroupResource extends Resource {
  constructor(scope: Component, id: string, override readonly props: GroupProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { name, gid, state = 'present' } = this.props;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;

      const exists = yield* this.checkExists(name, exec);

      if (state === 'present') {
        if (!exists) {
          const args: string[] = [];
          if (gid !== undefined) args.push('--gid', String(gid));
          args.push(name);
          yield* exec.execFile('groupadd', args, { become: this.props.become });
        } else if (gid !== undefined) {
          const groupLine = yield* exec.execFile('getent', ['group', name], {
            become: this.props.become,
            intent: 'read',
          });
          const currentGid = groupLine.split(':')[2] ?? '';
          if (parseInt(currentGid) !== gid) {
            yield* exec.execFile('groupmod', ['--gid', String(gid), name], { become: this.props.become });
          }
        }
      } else {
        if (exists) {
          yield* exec.execFile('groupdel', [name], { become: this.props.become });
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('groupdel', [name], { become: this.props.become });
    });
  }

  private checkExists(name: string, exec: SystemCommand): Effect.Effect<boolean, Error> {
    return exec.execFile('getent', ['group', name], { become: this.props.become, intent: 'read' }).pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false))
    );
  }
}

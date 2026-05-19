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
          let cmd = `groupadd`;
          if (gid !== undefined) cmd += ` --gid ${gid}`;
          cmd += ` ${name}`;
          yield* exec.run(cmd, { become: this.props.become });
        } else if (gid !== undefined) {
          // Check current GID
          const currentGid = yield* exec.run(`getent group ${name} | cut -d: -f3`, { become: this.props.become });
          if (parseInt(currentGid) !== gid) {
            yield* exec.run(`groupmod --gid ${gid} ${name}`, { become: this.props.become });
          }
        }
      } else {
        if (exists) {
          yield* exec.run(`groupdel ${name}`, { become: this.props.become });
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`groupdel ${name}`, { become: this.props.become });
    });
  }

  private checkExists(name: string, exec: SystemCommand): Effect.Effect<boolean, Error> {
    return exec.run(`getent group ${name}`, { become: this.props.become }).pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false))
    );
  }
}

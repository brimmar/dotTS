import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';
import { hashConfig } from '../core/hash';

export interface ServiceProps {
  name: string;
  state?: 'started' | 'stopped' | 'restarted' | 'reloaded';
  enabled?: boolean;
  user?: boolean;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class ServiceResource extends Resource {
  override readonly kind = 'service' as const;
  constructor(scope: Component, id: string, override readonly props: ServiceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    const { name, state, enabled, user } = this.props;
    const userFlag = user ? ['--user'] : [];
    const become = user ? this.props.become : (this.props.become === false ? undefined : (this.props.become ?? true));

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const platform = yield* PlatformService;
      const info = yield* platform.get();

      if (info.os !== 'linux') {
        throw new Error(`Service resource is currently only supported on Linux (systemd). Current OS: ${info.os}`);
      }

      if (enabled !== undefined) {
        const unitFileState = (
          yield* exec.execFile('systemctl', [...userFlag, 'show', '-p', 'UnitFileState', '--value', name], {
            intent: 'read',
          })
        ).trim();
        const isEnabled = unitFileState === 'enabled';
        if (enabled && !isEnabled) {
          yield* exec.execFile('systemctl', [...userFlag, 'enable', name], { become });
        } else if (!enabled && isEnabled) {
          yield* exec.execFile('systemctl', [...userFlag, 'disable', name], { become });
        }
      }

      if (state) {
        const activeState = (
          yield* exec.execFile('systemctl', [...userFlag, 'show', '-p', 'ActiveState', '--value', name], {
            intent: 'read',
          })
        ).trim();
        const isActive = activeState === 'active';

        switch (state) {
          case 'started':
            if (!isActive) yield* exec.execFile('systemctl', [...userFlag, 'start', name], { become });
            break;
          case 'stopped':
            if (isActive) yield* exec.execFile('systemctl', [...userFlag, 'stop', name], { become });
            break;
          case 'restarted':
            yield* exec.execFile('systemctl', [...userFlag, 'restart', name], { become });
            break;
          case 'reloaded':
            yield* exec.execFile('systemctl', [...userFlag, 'reload', name], { become });
            break;
        }
      }
    });
  }

  destroy() {
    const { name, user } = this.props;
    const userFlag = user ? ['--user'] : [];
    const become = user ? this.props.become : (this.props.become === false ? undefined : (this.props.become ?? true));
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const absent = ['does not exist', 'not found', 'not-found', 'not loaded'];
      yield* ignoreIfAbsent(exec.execFile('systemctl', [...userFlag, 'stop', name], { become }), absent);
      yield* ignoreIfAbsent(exec.execFile('systemctl', [...userFlag, 'disable', name], { become }), absent);
    });
  }
}

function ignoreIfAbsent(
  effect: Effect.Effect<string, Error>,
  tokens: string[],
): Effect.Effect<void, Error> {
  return Effect.flatMap(
    Effect.match(effect, {
      onFailure: (error) => error,
      onSuccess: () => undefined as Error | undefined,
    }),
    (error) => {
      if (!error) return Effect.void;
      const msg = error.message.toLowerCase();
      if (tokens.some((token) => msg.includes(token))) return Effect.void;
      return Effect.fail(error);
    },
  );
}

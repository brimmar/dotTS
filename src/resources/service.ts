import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';
import { hashConfig } from '../core/hash';

export interface ServiceProps {
  name: string;
  state?: 'started' | 'stopped' | 'restarted' | 'reloaded';
  enabled?: boolean;
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
    const { name, state, enabled } = this.props;

    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const platform = yield* PlatformService;
      const info = yield* platform.get();

      if (info.os !== 'linux') {
        throw new Error(`Service resource is currently only supported on Linux (systemd). Current OS: ${info.os}`);
      }

      if (enabled !== undefined) {
        const isEnabled = (yield* exec.run(`systemctl is-enabled ${name}`, { become: this.props.become })).trim() === 'enabled';
        if (enabled && !isEnabled) {
          yield* exec.run(`systemctl enable ${name}`, { become: this.props.become });
        } else if (!enabled && isEnabled) {
          yield* exec.run(`systemctl disable ${name}`, { become: this.props.become });
        }
      }

      if (state) {
        const isActive = (yield* exec.run(`systemctl is-active ${name}`, { become: this.props.become })).trim() === 'active';

        switch (state) {
          case 'started':
            if (!isActive) yield* exec.run(`systemctl start ${name}`, { become: this.props.become });
            break;
          case 'stopped':
            if (isActive) yield* exec.run(`systemctl stop ${name}`, { become: this.props.become });
            break;
          case 'restarted':
            yield* exec.run(`systemctl restart ${name}`, { become: this.props.become });
            break;
          case 'reloaded':
            yield* exec.run(`systemctl reload ${name}`, { become: this.props.become });
            break;
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      const absent = ['does not exist', 'not found', 'not-found', 'not loaded', 'inactive', 'not-active'];
      yield* ignoreIfAbsent(exec.run(`systemctl stop ${name}`, { become: this.props.become }), absent);
      yield* ignoreIfAbsent(exec.run(`systemctl disable ${name}`, { become: this.props.become }), absent);
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

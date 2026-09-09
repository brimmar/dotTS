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
        const isEnabled = (yield* exec.execFile('systemctl', ['is-enabled', name], { become: this.props.become })).trim() === 'enabled';
        if (enabled && !isEnabled) {
          yield* exec.execFile('systemctl', ['enable', name], { become: this.props.become });
        } else if (!enabled && isEnabled) {
          yield* exec.execFile('systemctl', ['disable', name], { become: this.props.become });
        }
      }

      if (state) {
        const isActive = (yield* exec.execFile('systemctl', ['is-active', name], { become: this.props.become })).trim() === 'active';

        switch (state) {
          case 'started':
            if (!isActive) yield* exec.execFile('systemctl', ['start', name], { become: this.props.become });
            break;
          case 'stopped':
            if (isActive) yield* exec.execFile('systemctl', ['stop', name], { become: this.props.become });
            break;
          case 'restarted':
            yield* exec.execFile('systemctl', ['restart', name], { become: this.props.become });
            break;
          case 'reloaded':
            yield* exec.execFile('systemctl', ['reload', name], { become: this.props.become });
            break;
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.execFile('systemctl', ['stop', name], { become: this.props.become });
      yield* exec.execFile('systemctl', ['disable', name], { become: this.props.become });
    });
  }
}

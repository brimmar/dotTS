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
        const isEnabled = (yield* exec.run(`systemctl is-enabled ${name}`)).trim() === 'enabled';
        if (enabled && !isEnabled) {
          yield* exec.run(`systemctl enable ${name}`);
        } else if (!enabled && isEnabled) {
          yield* exec.run(`systemctl disable ${name}`);
        }
      }

      if (state) {
        const isActive = (yield* exec.run(`systemctl is-active ${name}`)).trim() === 'active';

        switch (state) {
          case 'started':
            if (!isActive) yield* exec.run(`systemctl start ${name}`);
            break;
          case 'stopped':
            if (isActive) yield* exec.run(`systemctl stop ${name}`);
            break;
          case 'restarted':
            yield* exec.run(`systemctl restart ${name}`);
            break;
          case 'reloaded':
            yield* exec.run(`systemctl reload ${name}`);
            break;
        }
      }
    });
  }

  destroy() {
    const { name } = this.props;
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(`systemctl stop ${name}`);
      yield* exec.run(`systemctl disable ${name}`);
    });
  }
}

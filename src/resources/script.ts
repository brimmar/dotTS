import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';

export interface ScriptResourceProps {
  run: string;
  unless?: string;
  onlyIf?: string;
  workingDir?: string;
  environment?: Record<string, string>;
  dependsOn?: Component[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export class ScriptResource extends Resource {
  override readonly kind = 'script' as const;
  constructor(scope: Component, id: string, override readonly props: ScriptResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;

      if (this.props.unless) {
        const skip = yield* Effect.match(
          exec.run(this.props.unless, { cwd: this.props.workingDir, env: this.props.environment, become: this.props.become }),
          {
            onFailure: () => false,
            onSuccess: () => true,
          }
        );
        if (skip) return;
      }

      if (this.props.onlyIf) {
        const proceed = yield* Effect.match(
          exec.run(this.props.onlyIf, { cwd: this.props.workingDir, env: this.props.environment, become: this.props.become }),
          {
            onFailure: () => false,
            onSuccess: () => true,
          }
        );
        if (!proceed) return;
      }

      yield* exec.run(this.props.run, {
        cwd: this.props.workingDir,
        env: this.props.environment,
        become: this.props.become,
      });
    });
  }

  destroy() {
    return Effect.void;
  }
}
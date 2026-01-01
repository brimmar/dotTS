import { Effect } from 'effect';
import { Resource, Component } from '../core/component';
import { SystemCommand } from '../services/exec';
import { hashConfig } from '../core/hash';

export interface ScriptResourceProps {
  run: string;
  workingDir?: string;
  environment?: Record<string, string>;
  dependsOn?: Component[];
}

export class ScriptResource extends Resource {
  constructor(scope: Component, id: string, public readonly props: ScriptResourceProps) {
    super(scope, id, props);
  }

  hash() {
    return hashConfig(this.props);
  }

  apply() {
    return Effect.gen(this, function* () {
      const exec = yield* SystemCommand;
      yield* exec.run(this.props.run, {
        cwd: this.props.workingDir,
        env: this.props.environment,
      });
    });
  }

  destroy() {
    // Arbitrary scripts don't have a built-in destroy mechanism.
    // Users can use ScriptResource for cleanup in other ways if needed.
    return Effect.void;
  }
}

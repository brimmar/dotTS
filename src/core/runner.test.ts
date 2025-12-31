import { describe, it, expect, mock } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Runner } from './runner';
import { App, Stack } from './app';
import { Resource } from './component';
import { SecretManager } from '../services/secrets-manager';

class TestResource extends Resource {
  constructor(scope: any, id: string, public readonly action: () => Effect.Effect<void, Error>) {
    super(scope, id);
  }

  apply() {
    return this.action();
  }
}

describe('Runner', () => {
  it('should traverse the tree and execute resource actions', async () => {
    const app = new App();
    const stack = new Stack(app, 'dev');
    
    let executed = false;
    const action = () => Effect.sync(() => { executed = true; });
    
    new TestResource(stack, 'res', action);
    
    const program = Effect.gen(function* (_) {
      const runner = yield* _(Runner);
      yield* _(runner.run(app));
    });

    const runnable = program.pipe(Effect.provide(Runner.live));
    await Effect.runPromise(runnable);
    
    expect(executed).toBe(true);
  });

  it('should resolve secrets via SecretManager during resource application', async () => {
    const app = new App();
    const stack = new Stack(app, 'dev');
    
    let resolvedValue = '';
    const action = () => Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      resolvedValue = yield* _(sm.get('MY_KEY'));
    });
    
    new TestResource(stack, 'res', action);
    
    const SecretManagerMock = Layer.succeed(
      SecretManager,
      SecretManager.of({
        get: (name) => Effect.succeed('secret-value'),
        set: () => Effect.void,
        list: () => Effect.succeed([]),
        setPaths: () => Effect.void,
      })
    );

    const program = Effect.gen(function* (_) {
      const runner = yield* _(Runner);
      yield* _(runner.run(app));
    });

    const runnable = program.pipe(
      Effect.provide(Runner.live),
      Effect.provide(SecretManagerMock)
    );
    
    await Effect.runPromise(runnable);
    expect(resolvedValue).toBe('secret-value');
  });
});

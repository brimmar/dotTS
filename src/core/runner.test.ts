import { describe, it, expect, mock } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Runner } from './runner';
import { App, Stack } from './app';
import { Resource } from './component';

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
    
    // We need to implement a way for Resources to expose their "apply" logic.
    // For this test, we assume the Runner knows how to find and execute it.
    
    const program = Effect.gen(function* (_) {
      const runner = yield* _(Runner);
      yield* _(runner.run(app));
    });

    const runnable = Effect.provide(program, Runner.live);
    await Effect.runPromise(runnable);
    
    expect(executed).toBe(true);
  });
});

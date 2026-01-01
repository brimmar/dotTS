import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Runner, RunnerLive } from './runner';
import { App, Stack } from './app';
import { Resource, Component } from './component';
import { StateService } from '../services/state';

class TestResource extends Resource {
  public applied = false;
  public destroyed = false;

  constructor(scope: Component, id: string, public readonly _hash: string = 'hash', props: any = {}) {
    super(scope, id, props);
  }

  apply() {
    return Effect.sync(() => { this.applied = true; });
  }

  destroy() {
    return Effect.sync(() => { this.destroyed = true; });
  }

  hash() {
    return this._hash;
  }
}

describe('Runner', () => {
  const MockState = (initialState: any = {}) => Layer.succeed(StateService, StateService.of({
    setPath: () => Effect.void,
    load: () => Effect.succeed(initialState),
    save: () => Effect.void,
  }));

  it('should create new resources', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });
    
    // Provide MockState to RunnerLive
    const TestRunnerLayer = RunnerLive.pipe(Layer.provide(MockState()));
    
    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));
    
    expect(res.applied).toBe(true);
  });

  it('should execute resources in dependency order', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    const executionOrder: string[] = [];
    class OrderResource extends TestResource {
      apply() {
        return Effect.sync(() => { executionOrder.push(this.id); });
      }
    }

    const r1 = new OrderResource(stack, 'r1');
    const r2 = new OrderResource(stack, 'r2', 'hash', { dependsOn: [r1] });
    const r3 = new OrderResource(stack, 'r3', 'hash', { dependsOn: [r2] });

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });
    
    const TestRunnerLayer = RunnerLive.pipe(Layer.provide(MockState()));
    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));
    
    expect(executionOrder).toEqual(['r1', 'r2', 'r3']);
  });

  it('should execute resources in the same tier concurrently', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    let activeCount = 0;
    let maxActive = 0;

    class SlowResource extends TestResource {
      apply() {
        return Effect.gen(this, function* () {
          activeCount++;
          if (activeCount > maxActive) maxActive = activeCount;
          yield* Effect.sleep('10 millis');
          activeCount--;
        });
      }
    }

    new SlowResource(stack, 'r1');
    new SlowResource(stack, 'r2');
    new SlowResource(stack, 'r3');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(Layer.provide(MockState()));
    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    // With parallel execution, maxActive should be > 1
    expect(maxActive).toBeGreaterThan(1);
  });

  it('should serialize resources with the same concurrencyKey', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    let activeCount = 0;
    let maxActive = 0;

    class LockedResource extends TestResource {
      get concurrencyKey() { return 'global-lock'; }
      apply() {
        return Effect.gen(this, function* () {
          activeCount++;
          if (activeCount > maxActive) maxActive = activeCount;
          yield* Effect.sleep('10 millis');
          activeCount--;
        });
      }
    }

    new LockedResource(stack, 'r1');
    new LockedResource(stack, 'r2');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(Layer.provide(MockState()));
    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    // Even if they are in the same tier, they should be serialized
    expect(maxActive).toBe(1);
  });
});

import { describe, it, expect, beforeEach } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Runner, RunnerLive } from './runner';
import { App, Stack } from './app';
import { Resource, Component } from './component';
import { StateService, type AppState } from '../services/state';
import { registerResource } from './registry';

class TestResource extends Resource {
  override readonly kind = 'test' as const;
  public applied = false;
  public destroyed = false;
  static destroyedIds: string[] = [];
  static failDestroyIds: string[] = [];

  constructor(scope: Component, id: string, public readonly _hash: string = 'hash', props: any = {}) {
    super(scope, id, props);
  }

  override apply() {
    return Effect.sync(() => { this.applied = true; });
  }

  override destroy() {
    return Effect.gen(this, function* () {
      this.destroyed = true;
      TestResource.destroyedIds.push(this.id);
      if (TestResource.failDestroyIds.includes(this.id)) {
        return yield* Effect.fail(new Error(`destroy failed: ${this.id}`));
      }
    });
  }

  override hash() {
    return this._hash;
  }
}

registerResource('test', (scope, id, metadata) => new TestResource(scope, id, 'hash', metadata));

describe('Runner', () => {
  beforeEach(() => {
    TestResource.destroyedIds = [];
    TestResource.failDestroyIds = [];
  });

  const MockState = (initialState: any = {}, onSave?: (state: AppState) => void) => Layer.succeed(StateService, StateService.of({
    setPath: () => Effect.void,
    load: () => Effect.succeed(initialState),
    save: (state) => Effect.sync(() => { onSave?.(state); }),
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
      override apply() {
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
      override apply() {
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
      override get concurrencyKey() { return 'global-lock'; }
      override apply() {
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

  it('should still call apply when the resource hash matches last run', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState({ 'res-1': { hash: 'hash', kind: 'test', metadata: {} } })),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(res.applied).toBe(true);
  });

  it('should still call apply when the resource hash changed', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1', 'new');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState({ 'res-1': { hash: 'old', kind: 'test', metadata: {} } })),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(res.applied).toBe(true);
  });

  it('should destroy resources that left the graph', async () => {
    const app = new App();
    new Stack(app, 'test');
    let saved: AppState | undefined;

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState(
        { gone: { hash: 'hash', kind: 'test', metadata: {} } },
        (state) => { saved = state; },
      )),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(TestResource.destroyedIds).toContain('gone');
    expect(saved?.gone).toBeUndefined();
  });

  it('should not destroy resources that remain in the graph', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState({ 'res-1': { hash: 'hash', kind: 'test', metadata: {} } })),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(res.applied).toBe(true);
    expect(TestResource.destroyedIds).toEqual([]);
  });

  it('should warn and keep old state that is missing kind', async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg?: unknown) => { warnings.push(String(msg)); };

    const app = new App();
    new Stack(app, 'test');
    let saved: AppState | undefined;
    const gone = { hash: 'hash', metadata: {} };

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    try {
      const TestRunnerLayer = RunnerLive.pipe(
        Layer.provide(MockState(
          { gone },
          (state) => { saved = state; },
        )),
      );

      await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

      expect(TestResource.destroyedIds).toEqual([]);
      expect(warnings.some((w) => w.includes('cannot destroy gone: missing kind; keeping it in state until purged'))).toBe(true);
      expect(saved?.gone?.hash).toBe('hash');
      expect(saved?.gone?.kind).toBeUndefined();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('should destroy dependents before dependencies', async () => {
    const app = new App();
    new Stack(app, 'test');
    let saved: AppState | undefined;

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState(
        {
          parent: { hash: 'hash', kind: 'test', metadata: { path: '/tmp/parent' } },
          child: {
            hash: 'hash',
            kind: 'test',
            metadata: { path: '/tmp/parent/child', dependsOn: [{ id: 'parent' }] },
          },
        },
        (state) => { saved = state; },
      )),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(TestResource.destroyedIds).toEqual(['child', 'parent']);
    expect(saved?.parent).toBeUndefined();
    expect(saved?.child).toBeUndefined();
  });

  it('should skip destroy when a remaining resource still lives under dest', async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg?: unknown) => { warnings.push(String(msg)); };

    const app = new App();
    const stack = new Stack(app, 'test');
    new TestResource(stack, 'child', 'hash', { path: '/tmp/parent/child' });
    let saved: AppState | undefined;

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    try {
      const TestRunnerLayer = RunnerLive.pipe(
        Layer.provide(MockState(
          { parent: { hash: 'hash', kind: 'test', metadata: { path: '/tmp/parent' } } },
          (state) => { saved = state; },
        )),
      );

      await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

      expect(TestResource.destroyedIds).toEqual([]);
      expect(warnings.some((w) => w.includes('skip destroy parent'))).toBe(true);
      expect(saved?.parent).toBeDefined();
      expect(saved?.child).toBeDefined();
    } finally {
      console.warn = originalWarn;
    }
  });

  it('should persist state after each successful destroy', async () => {
    const app = new App();
    new Stack(app, 'test');
    const saves: AppState[] = [];
    TestResource.failDestroyIds = ['parent'];

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState(
        {
          parent: { hash: 'hash', kind: 'test', metadata: { path: '/tmp/parent' } },
          child: {
            hash: 'hash',
            kind: 'test',
            metadata: { path: '/tmp/parent/child', dependsOn: [{ id: 'parent' }] },
          },
        },
        (state) => { saves.push({ ...state }); },
      )),
    );

    await expect(Effect.runPromise(Effect.provide(program, TestRunnerLayer))).rejects.toThrow(/destroy failed: parent/);
    expect(TestResource.destroyedIds).toEqual(['child', 'parent']);
    expect(saves.length).toBeGreaterThan(0);
    const last = saves[saves.length - 1];
    expect(last?.child).toBeUndefined();
    expect(last?.parent).toBeDefined();
  });

  it('should fail the run when kind is unknown', async () => {
    const app = new App();
    new Stack(app, 'test');
    let saved: AppState | undefined;

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState(
        { gone: { hash: 'hash', kind: 'not-a-resource', metadata: {} } },
        (state) => { saved = state; },
      )),
    );

    await expect(Effect.runPromise(Effect.provide(program, TestRunnerLayer))).rejects.toThrow(/Unknown resource kind: not-a-resource/);
    expect(saved).toBeUndefined();
  });

  it('should treat hyphen state ids as the colon form and not destroy', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'file:/tmp/x');
    let saved: AppState | undefined;

    const program = Effect.gen(function* () {
      const runner = yield* Runner;
      yield* runner.run(app);
    });

    const TestRunnerLayer = RunnerLive.pipe(
      Layer.provide(MockState(
        { 'file-/tmp/x': { hash: 'hash', kind: 'test', metadata: {} } },
        (state) => { saved = state; },
      )),
    );

    await Effect.runPromise(Effect.provide(program, TestRunnerLayer));

    expect(res.applied).toBe(true);
    expect(TestResource.destroyedIds).toEqual([]);
    expect(saved?.['file:/tmp/x']).toBeDefined();
    expect(saved?.['file-/tmp/x']).toBeUndefined();
  });
});

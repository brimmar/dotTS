import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Runner } from './runner';
import { App, Stack } from './app';
import { Resource, Component } from './component';
import { StateService, AppState } from '../services/state';
import { color } from 'console-log-colors';

class TestResource extends Resource {
  public applied = false;
  public destroyed = false;
  public props = {};

  constructor(scope: any, id: string, public readonly _hash: string = 'hash') {
    super(scope, id);
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

function flatten(component: Component): Resource[] {
  let result: Resource[] = [];
  if (component instanceof Resource) {
    result.push(component);
  }
  for (const child of component.children) {
    result = result.concat(flatten(child));
  }
  return result;
}

const run = (component: Component) =>
  Effect.gen(function* () {
    const stateService = yield* StateService;
    const currentState = yield* stateService.load();
    const newState: AppState = {};
    
    const resources = flatten(component);

    for (const res of resources) {
      const id = res.id;
      const hash = res.hash();
      const oldState = currentState[id];

      if (!oldState) {
        yield* res.apply();
      } else if (oldState.hash !== hash) {
        yield* res.apply();
      } else {
        // No-op
      }

      newState[id] = { hash, metadata: (res as any).props || {} };
    }

    // Deletions not implemented fully yet
    
    yield* stateService.save(newState);
  });

describe('Runner', () => {
  it('should create new resources', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');

    let savedState: any = {};
    const MockState = Layer.succeed(StateService, StateService.of({
        setPath: () => Effect.void,
        load: () => Effect.succeed({}),
        save: (s) => Effect.sync(() => { savedState = s; }),
    }));

    const program = run(app);
    
    await Effect.runPromise(Effect.provide(program, MockState));
    
    expect(res.applied).toBe(true);
    expect(savedState['res-1']).toBeDefined();
    expect(savedState['res-1'].hash).toBe('hash');
  });

  it('should skip unchanged resources', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1', 'hash');

    const MockState = Layer.succeed(StateService, StateService.of({
        setPath: () => Effect.void,
        load: () => Effect.succeed({ 'res-1': { hash: 'hash', metadata: {} } }),
        save: () => Effect.void,
    }));

    const program = run(app);
    
    await Effect.runPromise(Effect.provide(program, MockState));
    
    expect(res.applied).toBe(false);
  });

  it('should update changed resources', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1', 'new-hash');

    let savedState: any = {};
    const MockState = Layer.succeed(StateService, StateService.of({
        setPath: () => Effect.void,
        load: () => Effect.succeed({ 'res-1': { hash: 'old-hash', metadata: {} } }),
        save: (s) => Effect.sync(() => { savedState = s; }),
    }));

    const program = run(app);
    
    await Effect.runPromise(Effect.provide(program, MockState));
    
    expect(res.applied).toBe(true);
    expect(savedState['res-1'].hash).toBe('new-hash');
  });
});

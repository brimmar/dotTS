import { Context, Effect, Layer } from 'effect';
import { Component, Resource, flatten } from './component';
import { StateService, AppState } from '../services/state';
import { color } from 'console-log-colors';
import { sortResourcesByTier } from './graph';

export interface Runner {
  readonly run: (component: Component) => Effect.Effect<void, Error>;
}

export const Runner = Context.GenericTag<Runner>('Runner');

export const RunnerLive = Layer.effect(
  Runner,
  Effect.gen(function* () {
    const stateService = yield* StateService;

    return Runner.of({
      run: (component: Component) =>
        Effect.gen(function* () {
          const currentState = yield* stateService.load();
          const newState: AppState = {};
          
          const rawResources = flatten(component);
          const tiers = sortResourcesByTier(rawResources);

          for (const tier of tiers) {
            // Group resources in the current tier by concurrencyKey
            const groups = new Map<string | undefined, Resource[]>();
            for (const res of tier) {
              const key = res.concurrencyKey;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(res);
            }

            // Execute groups concurrently
            yield* Effect.all(
              Array.from(groups.entries()).map(([key, resources]) =>
                Effect.gen(function* () {
                  // If key is undefined, resources can run concurrently with each other
                  if (key === undefined) {
                    yield* Effect.all(
                      resources.map((res) => runResource(res, currentState, newState)),
                      { concurrency: 'unbounded' }
                    );
                  } else {
                    // Resources with the same key must run sequentially
                    for (const res of resources) {
                      yield* runResource(res, currentState, newState);
                    }
                  }
                })
              ),
              { concurrency: 'unbounded' }
            );
          }

          // Detect deletions
          for (const id of Object.keys(currentState)) {
            if (!newState[id]) {
              console.log(color.red(`- Delete: ${id}`));
              // TODO: Re-hydrate and destroy resource
            }
          }

          yield* stateService.save(newState);
        }),
    });
  })
);

function runResource(res: Resource, currentState: AppState, newState: AppState) {
  return Effect.gen(function* () {
    const id = res.id;
    const hash = res.hash();
    const oldState = currentState[id];

    if (!oldState) {
      console.log(color.green(`+ Create: ${id}`));
      yield* res.apply();
    } else if (oldState.hash !== hash) {
      console.log(color.yellow(`~ Update: ${id}`));
      yield* res.apply();
    } else {
      console.log(color.gray(`  No-op:  ${id}`));
    }

    newState[id] = { hash, metadata: (res as any).props || {} };
  });
}

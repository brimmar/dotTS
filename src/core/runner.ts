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
            yield* Effect.all(
              tier.map((res) =>
                Effect.gen(function* () {
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
                    console.log(color.gray(`  No-op: ${id}`));
                  }

                  // We store props in metadata for future use (e.g. deletion)
                  newState[id] = { hash, metadata: (res as any).props || {} };
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
import { Context, Effect, Layer } from 'effect';
import { Component, Resource, flatten } from './component';
import { StateService, type AppState } from '../services/state';
import { color } from 'console-log-colors';
import { sortResourcesByTier } from './graph';
import { performance } from 'node:perf_hooks';

export interface Runner {
  readonly run: (component: Component) => Effect.Effect<void, Error, never>;
}

export const Runner = Context.GenericTag<Runner>('Runner');

export const RunnerLive = Layer.effect(
  Runner,
  Effect.gen(function* () {
    const stateService = yield* StateService;

    return Runner.of({
      run: (component: Component): Effect.Effect<void, Error, never> => Effect.gen(function* () {
        const stateService = yield* StateService;
        const startTime = performance.now();
        const currentState = yield* stateService.load();
        const newState: AppState = {};
        
        const rawResources = flatten(component);
        const tiers = sortResourcesByTier(rawResources);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const tier of tiers) {
          const groups = new Map<string | undefined, Resource[]>();
          for (const res of tier) {
            const key = res.concurrencyKey;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(res);
          }

          yield* Effect.all(
            Array.from(groups.entries()).map(([key, resources]) =>
              Effect.gen(function* () {
                if (key === undefined) {
                  yield* Effect.all(
                    resources.map((res) => 
                      Effect.gen(function* () {
                        const result = yield* runResource(res, currentState, newState);
                        if (result === 'created') created++;
                        else if (result === 'updated') updated++;
                        else skipped++;
                      })
                    ),
                    { concurrency: 'unbounded' }
                  );
                } else {
                  for (const res of resources) {
                    const result = yield* runResource(res, currentState, newState);
                    if (result === 'created') created++;
                    else if (result === 'updated') updated++;
                    else skipped++;
                  }
                }
              })
            ),
            { concurrency: 'unbounded' }
          );
        }

        let deleted = 0;
        for (const id of Object.keys(currentState)) {
          if (!newState[id]) {
            console.log(color.red(`- Delete: ${id}`));
            deleted++;
            // TODO: Re-hydrate and destroy resource
          }
        }

        yield* stateService.save(newState);

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + color.bold('Execution Summary:'));
        console.log(`${color.green(`+ ${created} created`)}`);
        console.log(`${color.yellow(`~ ${updated} updated`)}`);
        console.log(`${color.red(`- ${deleted} deleted`)}`);
        console.log(`${color.gray(`  ${skipped} skipped`)}`);
        console.log(color.cyan(`Total duration: ${duration}s`));
      }) as Effect.Effect<void, Error, never>,
    });
  })
);

type ResourceResult = 'created' | 'updated' | 'skipped';

function runResource(res: Resource, currentState: AppState, newState: AppState): Effect.Effect<ResourceResult, Error, any> {
  return Effect.gen(function* () {
    const id = res.id;
    const hash = res.hash();
    const oldState = currentState[id];

    let result: ResourceResult;

    if (!oldState) {
      console.log(color.green(`+ Create: ${id}`));
      yield* res.apply();
      result = 'created';
    } else if (oldState.hash !== hash) {
      console.log(color.yellow(`~ Update: ${id}`));
      yield* res.apply();
      result = 'updated';
    } else {
      console.log(color.gray(`  No-op:  ${id}`));
      result = 'skipped';
    }

    newState[id] = { hash, metadata: res.props || {} };
    return result;
  });
}
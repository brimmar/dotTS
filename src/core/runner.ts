import { Context, Effect, Layer, Schedule, Duration } from 'effect';
import { Component, Resource, flatten } from './component';
import { StateService, type AppState } from '../services/state';
import pc from 'picocolors';
import { isPathWithin, resourceManagedPath, sortDestroyResources, sortResourcesByTier } from './graph';
import { performance } from 'node:perf_hooks';
import { App } from './app';
import { rehydrate } from './registry';
import { migrateStateId, migrateStateKeys } from './ids';

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
        const startTime = performance.now();
        const currentState = migrateStateKeys(yield* stateService.load());
        const newState: AppState = {};
        
        const rawResources = flatten(component);
        const tiers = sortResourcesByTier(rawResources);

        let created = 0;
        let updated = 0;
        let converged = 0;

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
                        else converged++;
                      })
                    ),
                    { concurrency: 'unbounded' }
                  );
                } else {
                  for (const res of resources) {
                    const result = yield* runResource(res, currentState, newState);
                    if (result === 'created') created++;
                    else if (result === 'updated') updated++;
                    else converged++;
                  }
                }
              })
            ),
            { concurrency: 'unbounded' }
          );
        }

        let deleted = 0;
        const destroyScope = new App();
        const toDestroy: Resource[] = [];
        for (const id of Object.keys(currentState)) {
          if (hasStateId(newState, id)) continue;
          const oldState = currentState[id];
          if (!oldState || !oldState.kind) {
            console.warn(`cannot destroy ${id}: missing kind; keeping it in state until purged`);
            if (oldState) newState[id] = oldState;
            continue;
          }
          toDestroy.push(rehydrate(oldState.kind, id, oldState.metadata || {}, destroyScope));
        }

        const persisted: AppState = { ...newState };
        for (const res of toDestroy) {
          const previous = currentState[res.id];
          if (previous) persisted[res.id] = previous;
        }

        for (const res of sortDestroyResources(toDestroy)) {
          const dest = resourceManagedPath(res.props);
          if (dest && remainingUsesPath(dest, newState)) {
            console.warn(`skip destroy ${res.id}: remaining resources still under ${dest}`);
            continue;
          }
          yield* withRetry(res.destroy(), res);
          delete persisted[res.id];
          yield* stateService.save(persisted);
          deleted++;
          console.log(pc.red(`- Delete: ${res.id}`));
        }

        yield* stateService.save(persisted);

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + pc.bold('Execution Summary:'));
        console.log(`${pc.green(`+ ${created} created`)}`);
        console.log(`${pc.yellow(`~ ${updated} updated`)}`);
        console.log(`${pc.red(`- ${deleted} deleted`)}`);
        console.log(`${pc.gray(`  ${converged} converged`)}`);
        console.log(pc.cyan(`Total duration: ${duration}s`));
      }) as Effect.Effect<void, Error, never>,
    });
  })
);

type ResourceResult = 'created' | 'updated' | 'converged';

function hasStateId(state: AppState, id: string): boolean {
  if (id in state) return true;
  const canonical = migrateStateId(id);
  if (canonical in state) return true;
  for (const key of Object.keys(state)) {
    if (migrateStateId(key) === canonical) return true;
  }
  return false;
}

function remainingUsesPath(dest: string, remaining: AppState): boolean {
  for (const state of Object.values(remaining)) {
    const path = resourceManagedPath(state.metadata);
    if (path && isPathWithin(dest, path)) return true;
  }
  return false;
}

function runResource(res: Resource, currentState: AppState, newState: AppState): Effect.Effect<ResourceResult, Error, any> {
  return Effect.gen(function* () {
    const id = res.id;
    const hash = res.hash();
    const stateId = migrateStateId(id);
    const oldState = stateId in currentState ? currentState[stateId] : currentState[id];

    let result: ResourceResult;

    if (!oldState) {
      console.log(pc.green(`+ Create: ${id}`));
      result = 'created';
    } else if (oldState.hash !== hash) {
      console.log(pc.yellow(`~ Update: ${id}`));
      result = 'updated';
    } else {
      console.log(pc.gray(`~ Converge: ${id}`));
      result = 'converged';
    }

    yield* withRetry(res.apply(), res);

    newState[id] = { hash, kind: res.kind, metadata: res.props || {} };
    return result;
  });
}

function withRetry<A, E, R>(effect: Effect.Effect<A, E, R>, res: Resource): Effect.Effect<A, E, R> {
  const { retries, retryDelay = 1 } = res.props;
  if (!retries || retries <= 0) {
    return effect;
  }

  return Effect.retry(
    effect,
    Schedule.recurs(retries).pipe(
      Schedule.addDelay(() => Duration.seconds(retryDelay))
    )
  );
}
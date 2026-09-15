import { Context, Effect, Layer, Schedule, Duration } from 'effect';
import { Component, Resource, flatten } from './component';
import { StateService, type AppState } from '../services/state';
import pc from 'picocolors';
import { isPathWithin, resourceManagedPath, sortDestroyResources, sortResourcesByTier } from './graph';
import { performance } from 'node:perf_hooks';
import { App } from './app';
import { rehydrate } from './registry';
import { migrateStateId, migrateStateKeys } from './ids';
import { currentResourceTag } from '../services/exec';

export interface ResourceExecutionResult {
  id: string;
  kind: string;
  status: 'created' | 'updated' | 'converged' | 'deleted';
  durationSeconds?: number;
}

export interface ExecutionReport {
  created: number;
  updated: number;
  deleted: number;
  converged: number;
  durationSeconds: number;
  resources: ResourceExecutionResult[];
}

export interface RunnerOptions {
  silent?: boolean;
  verbose?: boolean;
}

export interface Runner {
  readonly run: (
    component: Component,
    options?: RunnerOptions,
  ) => Effect.Effect<ExecutionReport, Error, never>;
}

export const Runner = Context.GenericTag<Runner>('Runner');

export const RunnerLive = Layer.effect(
  Runner,
  Effect.gen(function* () {
    const stateService = yield* StateService;

    return Runner.of({
      run: (
        component: Component,
        options?: RunnerOptions,
      ): Effect.Effect<ExecutionReport, Error, never> =>
        Effect.gen(function* () {
          const startTime = performance.now();
          const currentState = migrateStateKeys(yield* stateService.load());
          const newState: AppState = {};
          const executedResources: ResourceExecutionResult[] = [];

          const rawResources = flatten(component);
          if (!options?.silent) {
            warnLeftoverScriptLineState(currentState, rawResources);
          }
          const resourceIndexMap = new Map<string, number>();
          rawResources.forEach((res, i) => resourceIndexMap.set(res.id, i + 1));
          const tiers = sortResourcesByTier(rawResources);

        let created = 0;
        let updated = 0;
        let converged = 0;

        const tierConcurrency = 'unbounded';

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
                        const { status, durationSeconds } = yield* runResource(
                          res,
                          currentState,
                          newState,
                          options,
                          resourceIndexMap.get(res.id),
                        );
                        if (status === 'created') created++;
                        else if (status === 'updated') updated++;
                        else converged++;
                        executedResources.push({
                          id: res.id,
                          kind: res.kind,
                          status,
                          durationSeconds,
                        });
                      })
                    ),
                    { concurrency: tierConcurrency }
                  );
                } else {
                  for (const res of resources) {
                    const { status, durationSeconds } = yield* runResource(
                      res,
                      currentState,
                      newState,
                      options,
                      resourceIndexMap.get(res.id),
                    );
                    if (status === 'created') created++;
                    else if (status === 'updated') updated++;
                    else converged++;
                    executedResources.push({
                      id: res.id,
                      kind: res.kind,
                      status,
                      durationSeconds,
                    });
                  }
                }
              })
            ),
            { concurrency: tierConcurrency }
          );
        }

        let deleted = 0;
        const destroyScope = new App();
        const toDestroy: Resource[] = [];
        for (const id of Object.keys(currentState)) {
          if (hasStateId(newState, id, currentState[id]?.kind)) continue;
          const oldState = currentState[id];
          if (!oldState || !oldState.kind) {
            if (!options?.silent) {
              console.warn(`cannot destroy ${id}: missing kind; keeping it in state until purged`);
            }
            if (oldState) newState[id] = oldState;
            continue;
          }
          toDestroy.push(rehydrate(oldState.kind, id, { ...oldState.metadata, dependsOn: undefined }, destroyScope));
        }

        const persisted: AppState = { ...newState };
        for (const res of toDestroy) {
          const previous = currentState[res.id];
          if (previous) persisted[res.id] = previous;
        }

        const sortedDestroy = sortDestroyResources(toDestroy);
        for (const [i, res] of sortedDestroy.entries()) {
          const dest = resourceManagedPath(res.props);
          if (dest && remainingUsesPath(dest, newState)) {
            if (!options?.silent) {
              console.warn(`skip destroy ${res.id}: remaining resources still under ${dest}`);
            }
            continue;
          }
          const destroyTag = `#del-${i + 1} [${res.id}]`;
          const destStartTime = performance.now();
          yield* withRetry(res.destroy(), res).pipe(
            Effect.locally(currentResourceTag, destroyTag),
          );
          const destDurationMs = performance.now() - destStartTime;
          const destDurationSeconds = Number((destDurationMs / 1000).toFixed(3));
          delete persisted[res.id];
          yield* stateService.save(persisted);
          deleted++;
          if (!options?.silent) {
            const timeStr = pc.dim(formatDuration(destDurationMs));
            if (options?.verbose) {
              console.log(alignRight(`${pc.cyan(destroyTag)} ${pc.red(`- Delete: ${res.id}`)}`, timeStr));
            } else {
              console.log(alignRight(pc.red(`- Delete: ${res.id}`), timeStr));
            }
          }
          executedResources.push({
            id: res.id,
            kind: res.kind,
            status: 'deleted',
            durationSeconds: destDurationSeconds,
          });
        }

        yield* stateService.save(persisted);

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (!options?.silent) {
          console.log('\n' + pc.bold('Execution Summary:'));
          console.log(`${pc.green(`+ ${created} created`)}`);
          console.log(`${pc.yellow(`~ ${updated} updated`)}`);
          console.log(`${pc.red(`- ${deleted} deleted`)}`);
          console.log(`${pc.gray(`  ${converged} converged`)}`);
          console.log(pc.cyan(`Total duration: ${duration}s`));
        }

        return {
          created,
          updated,
          deleted,
          converged,
          durationSeconds: Number(duration),
          resources: executedResources,
        };
      }) as Effect.Effect<ExecutionReport, Error, never>,
    });
  })
);

type ResourceResult = 'created' | 'updated' | 'converged';

function hasStateId(state: AppState, id: string, kind?: string): boolean {
  if (id in state) return true;
  const canonical = migrateStateId(id, kind);
  if (canonical in state) return true;
  for (const [key, value] of Object.entries(state)) {
    const other = migrateStateId(key, value.kind);
    if (other === canonical || other === id) return true;
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

function warnLeftoverScriptLineState(currentState: AppState, resources: Resource[]) {
  const currentIds = new Set(resources.map((res) => res.id));
  const leftover = Object.keys(currentState).some(
    (id) => (id.startsWith('script-') || id.startsWith('line-')) && !currentIds.has(id),
  );
  if (!leftover) return;
  console.warn(
    pc.yellow(
      'Leftover script-/line- state hashes will be treated as deleted and the new hashed ids as creates. Non-idempotent scripts will re-run on this upgrade.',
    ),
  );
}

function metadataForState(props: Record<string, unknown> = {}): Record<string, unknown> {
  const { dependsOn, ...rest } = props;
  return {
    ...rest,
    ...(Array.isArray(dependsOn)
      ? { dependsOn: dependsOn.map((d) => ({ id: (d as { id: string }).id })) }
      : {}),
  };
}

function visibleLength(str: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape codes for terminal width
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').length;
}

export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = (seconds % 60).toFixed(1);
  return `${mins}m ${remSecs}s`;
}

export function alignRight(
  left: string,
  right: string,
  maxWidth = process.stdout.columns || 80,
): string {
  const leftLen = visibleLength(left);
  const rightLen = visibleLength(right);
  const padding = maxWidth - leftLen - rightLen;
  if (padding > 1) {
    return left + ' '.repeat(padding) + right;
  }
  return left + '  ' + right;
}

interface RunResourceOutcome {
  status: ResourceResult;
  durationSeconds: number;
}

function runResource(
  res: Resource,
  currentState: AppState,
  newState: AppState,
  options?: RunnerOptions,
  stepIndex?: number,
): Effect.Effect<RunResourceOutcome, Error, any> {
  return Effect.gen(function* () {
    const id = res.id;
    const hash = res.hash();
    const stateId = migrateStateId(id, res.kind);
    const oldState = stateId in currentState ? currentState[stateId] : currentState[id];

    let result: ResourceResult;
    let labelPrefix: string;

    if (!oldState) {
      labelPrefix = pc.green(`+ Create: ${id}`);
      result = 'created';
    } else if (oldState.hash !== hash) {
      labelPrefix = pc.yellow(`~ Update: ${id}`);
      result = 'updated';
    } else {
      labelPrefix = pc.gray(`~ Converge: ${id}`);
      result = 'converged';
    }

    const stepTag = stepIndex ? `#${stepIndex} [${id}]` : `[${id}]`;
    const silent = options?.silent;

    if (options?.verbose && !silent) {
      console.log(pc.bold(pc.blue('=>')) + ' ' + pc.cyan(stepTag));
    }

    const startTime = performance.now();
    yield* withRetry(res.apply(), res).pipe(
      Effect.locally(currentResourceTag, stepTag),
    );
    const durationMs = performance.now() - startTime;
    const durationSeconds = Number((durationMs / 1000).toFixed(3));

    if (!silent) {
      const timeStr = pc.dim(formatDuration(durationMs));
      if (options?.verbose) {
        console.log(alignRight(`${pc.cyan(stepTag)} ${labelPrefix}`, timeStr));
      } else {
        console.log(alignRight(labelPrefix, timeStr));
      }
    }

    newState[id] = { hash, kind: res.kind, metadata: metadataForState({ ...(res.props as object) }) };
    return { status: result, durationSeconds };
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
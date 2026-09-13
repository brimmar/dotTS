import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { dirname, join } from 'node:path';

export interface ResourceState {
  hash: string;
  kind: string;
  metadata: Record<string, unknown>;
}

export type AppState = Record<string, ResourceState>;

export interface StateService {
  readonly setPath: (path: string) => Effect.Effect<void>;
  readonly load: () => Effect.Effect<AppState, Error>;
  readonly save: (state: AppState) => Effect.Effect<void, Error>;
}

export const StateService = Context.GenericTag<StateService>('StateService');

export const StateServiceLive = Layer.effect(
  StateService,
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    let statePath = join(process.cwd(), '.dotts/state.json');

    return StateService.of({
      setPath: (path) => Effect.sync(() => { statePath = path; }),
      load: () =>
        Effect.gen(function* () {
          const exists = yield* fs.exists(statePath);
          if (!exists) return {};
          const content = yield* fs.readFile(statePath);
          return JSON.parse(content) as AppState;
        }),
      save: (state) =>
        Effect.gen(function* () {
          yield* fs.mkdir(dirname(statePath));
          yield* fs.writeFile(statePath, JSON.stringify(state, null, 2));
        }),
    });
  })
);
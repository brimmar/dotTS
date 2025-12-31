import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { dirname, join } from 'node:path';

export interface ResourceState {
  hash: string;
  metadata: Record<string, any>;
}

export type AppState = Record<string, ResourceState>;

export class StateService extends Context.Tag('StateService')<
  StateService,
  {
    readonly setPath: (path: string) => Effect.Effect<void>;
    readonly load: () => Effect.Effect<AppState, Error>;
    readonly save: (state: AppState) => Effect.Effect<void, Error>;
  }
>() {}

export const StateServiceLive = Layer.effect(
  StateService,
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem);
    let statePath = join(process.cwd(), '.dotts/state.json');

    return StateService.of({
      setPath: (path) => Effect.sync(() => { statePath = path; }),
      load: () =>
        Effect.gen(function* (_) {
          const exists = yield* _(fs.exists(statePath));
          if (!exists) return {};
          const content = yield* _(fs.readFile(statePath));
          return JSON.parse(content) as AppState;
        }),
      save: (state) =>
        Effect.gen(function* (_) {
          yield* _(fs.mkdir(dirname(statePath)));
          yield* _(fs.writeFile(statePath, JSON.stringify(state, null, 2)));
        }),
    });
  })
);

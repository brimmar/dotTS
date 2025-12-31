import { Context, Effect, Layer } from 'effect';
import { Component, Resource } from './component';

export interface Runner {
  readonly run: (component: Component) => Effect.Effect<void, Error>;
}

export const Runner = Context.GenericTag<Runner>('Runner');

export const RunnerLive = Layer.succeed(
  Runner,
  Runner.of({
    run: (component: Component) =>
      Effect.gen(function* () {
        if (component instanceof Resource) {
          yield* component.apply();
        }

        for (const child of component.children) {
          yield* (yield* Runner).run(child);
        }
      }),
  })
);
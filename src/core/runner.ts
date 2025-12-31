import { Context, Effect, Layer } from 'effect';
import { Component, Resource } from './component';

export class Runner extends Context.Tag('Runner')<
  Runner,
  {
    readonly run: (root: Component) => Effect.Effect<void, Error>;
  }
>() {
  static live = Layer.succeed(
    Runner,
    Runner.of({
      run: (root: Component) => {
        const execute = (component: Component): Effect.Effect<void, Error> => {
          return Effect.gen(function* (_) {
            if (component instanceof Resource) {
              yield* _(component.apply());
            }
            
            for (const child of component.children) {
              yield* _(execute(child));
            }
          });
        };

        return execute(root);
      },
    })
  );
}

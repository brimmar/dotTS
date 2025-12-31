import { Context, Effect, Layer } from 'effect';
import { Component, flatten } from '../core/component';
import { SecretManager } from './secrets-manager';
import { FileSystem } from './fs';
import { SecretToken } from '../core/secret';

export interface ValidationService {
  readonly validate: (component: Component) => Effect.Effect<void, Error>;
}

export const ValidationService = Context.GenericTag<ValidationService>('ValidationService');

export const ValidationServiceLive = Layer.succeed(
  ValidationService,
  ValidationService.of({
    validate: (component: Component) =>
      Effect.gen(function* () {
        const sm = yield* SecretManager;
        const resources = flatten(component);
        
        for (const res of resources) {
          const props = (res as any).props || {};
          for (const key of Object.keys(props)) {
            const value = props[key];
            if (value instanceof SecretToken) {
              const secrets = yield* sm.list();
              if (!secrets.includes(value.name)) {
                throw new Error(`Secret not found: ${value.name} (referenced by ${res.id})`);
              }
            }
          }
        }
      }),
  })
);
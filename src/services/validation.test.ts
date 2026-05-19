import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { ValidationService, ValidationServiceLive } from './validation';
import { FileSystem } from './fs';
import { SecretManager, SecretManagerLive } from './secrets-manager';
import { App, Stack } from '../core/app';
import { FileResource } from '../resources/file';
import { secret } from '../core/secret';

describe('ValidationService', () => {
  const MockFS = Layer.succeed(FileSystem, FileSystem.of({} as any));
  
  const getMockSM = (secrets: string[]) => Layer.succeed(SecretManager, SecretManager.of({
    list: () => Effect.succeed(secrets),
    get: () => Effect.succeed(''),
    set: () => Effect.void,
    setPaths: () => Effect.void,
    remove: () => Effect.void,
  }));

  it('should validate a correct component tree', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    new FileResource(stack, 'file-1', { path: '/tmp/ok', content: 'hello' });

    const program = Effect.gen(function* () {
      const validator = yield* ValidationService;
      yield* validator.validate(app);
    });

    const MainLive = ValidationServiceLive.pipe(
      Layer.provideMerge(getMockSM([])),
      Layer.provideMerge(MockFS)
    );

    await Effect.runPromise(Effect.provide(program, MainLive));
  });

  it('should fail if a referenced secret is missing', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    new FileResource(stack, 'file-1', { path: '/tmp/ok', content: secret('MISSING_KEY') });

    const program = Effect.gen(function* () {
      const validator = yield* ValidationService;
      yield* validator.validate(app);
    });

    const MainLive = ValidationServiceLive.pipe(
      Layer.provideMerge(getMockSM([])),
      Layer.provideMerge(MockFS)
    );

    expect(Effect.runPromise(Effect.provide(program, MainLive))).rejects.toThrow(/Secret not found: MISSING_KEY/);
  });
});
import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { RemoteRepoService, RemoteRepoServiceLive } from './remote-repo';
import { SystemCommand } from './exec';
import { FileSystem } from './fs';

describe('RemoteRepoService', () => {
  it('should resolve shorthand to GitHub URL', async () => {
    const program = Effect.gen(function* () {
      const service = yield* RemoteRepoService;
      return yield* service.resolve('brimmar/dotts');
    });

    const result = await Effect.runPromise(program.pipe(
      Effect.provide(RemoteRepoServiceLive),
      Effect.provide(Layer.succeed(SystemCommand, SystemCommand.of({ run: () => Effect.succeed('') }))),
      Effect.provide(Layer.succeed(FileSystem, FileSystem.of({} as any)))
    ));

    expect(result).toBe('https://github.com/brimmar/dotts.git');
  });

  it('should clone a repository', async () => {
    let executedCommand = '';
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: (cmd) => Effect.sync(() => { executedCommand = cmd; return ''; })
    }));

    const program = Effect.gen(function* () {
      const service = yield* RemoteRepoService;
      yield* service.clone('https://github.com/brimmar/dotts.git', '/tmp/dotts');
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(RemoteRepoServiceLive),
      Effect.provide(MockExec),
      Effect.provide(Layer.succeed(FileSystem, FileSystem.of({} as any)))
    ));

    expect(executedCommand).toContain('git clone https://github.com/brimmar/dotts.git /tmp/dotts');
  });
});

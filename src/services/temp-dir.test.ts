import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { TempDirService, TempDirServiceLive } from './temp-dir';
import { FileSystem } from './fs';

describe('TempDirService', () => {
  it('should create and clean up a temporary directory', async () => {
    let createdDir = '';
    let removedDir = '';
    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      mkdir: (path: string) => Effect.sync(() => { createdDir = path; }),
      rm: (path: string) => Effect.sync(() => { removedDir = path; }),
      rmdir: () => Effect.void,
      exists: () => Effect.succeed(false),
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      symlink: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
    }));

    const program = Effect.gen(function* () {
      const temp = yield* TempDirService;
      return yield* temp.use((dir) => Effect.sync(() => dir));
    });

    const result = await Effect.runPromise(program.pipe(
      Effect.provide(TempDirServiceLive),
      Effect.provide(MockFS)
    ));

    expect(result).toContain('dotts-');
    expect(createdDir).toBe(result);
    expect(removedDir).toBe(result);
  });
});

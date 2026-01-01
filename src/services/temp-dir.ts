import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface TempDirService {
  readonly use: <A, E, R>(
    f: (path: string) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | Error, R>;
}

export const TempDirService = Context.GenericTag<TempDirService>('TempDirService');

export const TempDirServiceLive = Layer.effect(
  TempDirService,
  Effect.gen(function* () {
    const fs = yield* FileSystem;

    return TempDirService.of({
      use: (f) => {
        const path = join(tmpdir(), `dotts-${randomBytes(4).toString('hex')}`);
        
        const acquire = fs.mkdir(path).pipe(Effect.as(path));
        const release = (path: string) => fs.rm(path);

        return Effect.acquireUseRelease(acquire, f, release);
      },
    });
  })
);

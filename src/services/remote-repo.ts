import { Context, Effect, Layer } from 'effect';
import { SystemCommand } from './exec';

export interface RemoteRepoService {
  readonly resolve: (identifier: string) => Effect.Effect<string, Error>;
  readonly clone: (url: string, destination: string) => Effect.Effect<void, Error>;
  readonly isRemote: (identifier: string) => boolean;
}

export const RemoteRepoService = Context.GenericTag<RemoteRepoService>('RemoteRepoService');

export const RemoteRepoServiceLive = Layer.effect(
  RemoteRepoService,
  Effect.gen(function* () {
    const exec = yield* SystemCommand;

    return RemoteRepoService.of({
      isRemote: (identifier) => {
        if (identifier.includes('://')) return true;
        const parts = identifier.split('/');
        if (!identifier.startsWith('.') && !identifier.startsWith('/') && parts.length === 2 && parts[0] && parts[1]) return true;
        return false;
      },
      resolve: (identifier) =>
        Effect.sync(() => {
          if (identifier.includes('://')) {
            return identifier;
          }
          if (identifier.split('/').length === 2) {
            return `https://github.com/${identifier}.git`;
          }
          throw new Error(`Invalid repository identifier: ${identifier}`);
        }),
      clone: (url, destination) =>
        exec.run(`git clone ${url} ${destination}`).pipe(Effect.asVoid),
    });
  })
);
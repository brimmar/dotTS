import { Context, Effect, Layer } from 'effect';
import { platform, arch } from 'node:os';
import { FileSystem } from './fs';

export interface PlatformInfo {
  os: string;
  arch: string;
  distro?: string;
}

export interface PlatformService {
  readonly get: () => Effect.Effect<PlatformInfo, Error>;
}

export const PlatformService = Context.GenericTag<PlatformService>('PlatformService');

export const PlatformServiceLive = Layer.effect(
  PlatformService,
  Effect.gen(function* () {
    const fs = yield* FileSystem;

    return PlatformService.of({
      get: () =>
        Effect.gen(function* () {
          const currentOS = platform();
          const currentArch = arch();
          let distro: string | undefined;

          if (currentOS === 'linux') {
            const osReleaseExists = yield* fs.exists('/etc/os-release');
            if (osReleaseExists) {
              const content = yield* fs.readFile('/etc/os-release');
              const idMatch = content.match(/^ID=(.*)$/m);
              if (idMatch) {
                distro = idMatch[1].replace(/"/g, '');
              }
            }
          }

          return {
            os: currentOS,
            arch: currentArch,
            distro,
          };
        }),
    });
  })
);
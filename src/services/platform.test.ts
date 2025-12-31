import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { PlatformService, PlatformServiceLive } from './platform';
import { FileSystemLive } from './fs';

describe('PlatformService', () => {
  it('should detect the current platform', async () => {
    const program = Effect.gen(function* () {
      const platform = yield* PlatformService;
      const info = yield* platform.get();
      return info;
    });

    const MainLive = PlatformServiceLive.pipe(
      Layer.provideMerge(FileSystemLive)
    );

    const info = await Effect.runPromise(Effect.provide(program, MainLive));
    
    expect(info.os).toBeDefined();
    expect(info.arch).toBeDefined();
    if (info.os === 'linux') {
      expect(info.distro).toBeDefined();
    }
  });
});

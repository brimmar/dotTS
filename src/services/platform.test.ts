import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import {
  isDebianFamily,
  parseOsRelease,
  platformDistroIds,
  PlatformService,
  PlatformServiceLive,
} from './platform';
import { FileSystemLive } from './fs';
import { SystemCommandLive } from './exec';

describe('parseOsRelease', () => {
  it('parses Pop!_OS ID and ID_LIKE', () => {
    const parsed = parseOsRelease(`
NAME="Pop!_OS"
ID=pop
ID_LIKE="ubuntu debian"
VERSION_ID="22.04"
`);
    expect(parsed.distro).toBe('pop');
    expect(parsed.distroLike).toEqual(['ubuntu', 'debian']);
    expect(isDebianFamily(parsed)).toBe(true);
    expect(platformDistroIds(parsed)).toEqual(['pop', 'ubuntu', 'debian']);
  });

  it('parses unquoted ID_LIKE tokens', () => {
    const parsed = parseOsRelease('ID=linuxmint\nID_LIKE=ubuntu\n');
    expect(parsed.distro).toBe('linuxmint');
    expect(parsed.distroLike).toEqual(['ubuntu']);
    expect(isDebianFamily(parsed)).toBe(true);
  });

  it('does not treat fedora as Debian-family', () => {
    const parsed = parseOsRelease('ID=fedora\nID_LIKE="rhel fedora"\n');
    expect(parsed.distro).toBe('fedora');
    expect(isDebianFamily(parsed)).toBe(false);
  });
});

describe('PlatformService', () => {
  it('should detect the current platform', async () => {
    const program = Effect.gen(function* () {
      const platform = yield* PlatformService;
      const info = yield* platform.get();
      return info;
    });

    const MainLive = PlatformServiceLive.pipe(
      Layer.provideMerge(FileSystemLive),
      Layer.provideMerge(SystemCommandLive)
    );

    const info = await Effect.runPromise(Effect.provide(program, MainLive));
    
    expect(info.os).toBeDefined();
    expect(info.arch).toBeDefined();
    if (info.os === 'linux') {
      expect(info.distro).toBeDefined();
    }
  });
});

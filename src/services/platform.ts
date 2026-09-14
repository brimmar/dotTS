import { Context, Effect, Layer } from 'effect';
import { platform, arch } from 'node:os';
import { FileSystem } from './fs';

export interface PlatformInfo {
  os: string;
  arch: string;
  distro?: string;
  /** Tokens from os-release ID_LIKE (e.g. ubuntu debian on Pop!_OS). */
  distroLike?: string[];
}

const DEBIAN_FAMILY = new Set(['ubuntu', 'debian', 'pop']);

function unquoteOsReleaseValue(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, '');
}

/** Parse ID and ID_LIKE from /etc/os-release text. */
export function parseOsRelease(content: string): { distro?: string; distroLike: string[] } {
  const idMatch = content.match(/^ID=(.*)$/m);
  const likeMatch = content.match(/^ID_LIKE=(.*)$/m);
  const distro = idMatch?.[1] ? unquoteOsReleaseValue(idMatch[1]) : undefined;
  const distroLike = likeMatch?.[1]
    ? unquoteOsReleaseValue(likeMatch[1]).split(/\s+/).filter(Boolean)
    : [];
  return { distro, distroLike };
}

/** ID plus ID_LIKE tokens, de-duplicated. */
export function platformDistroIds(info: Pick<PlatformInfo, 'distro' | 'distroLike'>): string[] {
  const ids = [info.distro, ...(info.distroLike ?? [])].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export function isDebianFamily(info: Pick<PlatformInfo, 'distro' | 'distroLike'>): boolean {
  return platformDistroIds(info).some((id) => DEBIAN_FAMILY.has(id));
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

          let distroLike: string[] = [];
          if (currentOS === 'linux') {
            const osReleaseExists = yield* fs.exists('/etc/os-release');
            if (osReleaseExists) {
              const content = yield* fs.readFile('/etc/os-release');
              const parsed = parseOsRelease(content);
              distro = parsed.distro;
              distroLike = parsed.distroLike;
            }
          }

          return {
            os: currentOS,
            arch: currentArch,
            distro,
            distroLike: distroLike.length > 0 ? distroLike : undefined,
          };
        }),
    });
  })
);
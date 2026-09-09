import { exists, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import * as publicApi from '../public';
import type { PlatformInfo } from '../services/platform';
import { App, Stack } from './app';
import { ActiveContext } from './context';

const DEFAULT_EXPORT_ERROR =
  'Configuration file must export a default function: export default () => { ... }';

type GlobalWithDottsApi = typeof globalThis & {
  __dotts_public_api__?: typeof publicApi;
};

let dottsPluginInstalled = false;

function bindPublicApi(): void {
  (globalThis as GlobalWithDottsApi).__dotts_public_api__ = publicApi;
}

function publicApiExportRecord(): Record<string, unknown> {
  const exported: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(publicApi)) {
    if (name === '__esModule') continue;
    exported[name] = value;
  }
  return exported;
}

function publicApiShimSource(): string {
  const names = Object.keys(publicApi).filter((name) => name !== '__esModule');
  return [
    'const __api__ = globalThis.__dotts_public_api__;',
    ...names.map((name) => `export const ${name} = __api__['${name}'];`),
  ].join('\n');
}

function tryInstallDottsPlugin(): boolean {
  if (dottsPluginInstalled) return true;
  if (typeof Bun === 'undefined' || typeof Bun.plugin !== 'function') {
    return false;
  }

  try {
    Bun.plugin({
      name: 'dotts-runtime',
      setup(build) {
        build.module('dotts', () => ({
          exports: publicApiExportRecord(),
          loader: 'object',
        }));
      },
    });
    dottsPluginInstalled = true;
    return true;
  } catch {
    return false;
  }
}

async function installRuntimeFallback(configDir: string): Promise<() => Promise<void>> {
  const runtimeDir = join(configDir, '.dotts', 'runtime');
  const runtimeFile = join(runtimeDir, 'dotts.mjs');
  const tsconfigPath = join(configDir, 'tsconfig.json');
  const wroteTsconfig = !(await exists(tsconfigPath));

  await mkdir(runtimeDir, { recursive: true });
  await writeFile(runtimeFile, publicApiShimSource(), 'utf8');

  if (wroteTsconfig) {
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          paths: {
            dotts: ['./.dotts/runtime/dotts.mjs'],
          },
        },
      }),
      'utf8',
    );
  }

  return async () => {
    if (wroteTsconfig) {
      await rm(tsconfigPath, { force: true });
    }
    await rm(runtimeDir, { recursive: true, force: true });
  };
}

async function prepareDottsSpecifier(configDir: string): Promise<() => Promise<void>> {
  if (tryInstallDottsPlugin()) {
    return async () => {};
  }
  return installRuntimeFallback(configDir);
}

export async function loadConfig(configPath: string): Promise<{ app: App; config: { name: string } }> {
  const absolutePath = resolve(configPath);

  if (!(await exists(absolutePath))) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  bindPublicApi();

  const configDir = dirname(absolutePath);
  const cleanup = await prepareDottsSpecifier(configDir);

  try {
    const module = (await import(absolutePath)) as { default?: unknown };

    const app = new App();
    const stack = new Stack(app, 'default');

    const currentOS = platform();
    let distro: string | undefined;
    if (currentOS === 'linux') {
      try {
        const osRelease = await readFile('/etc/os-release', 'utf-8');
        const match = osRelease.match(/^ID=(.*)$/m);
        if (match) distro = match[1]?.replace(/"/g, '').trim();
      } catch {
        // /etc/os-release not available. distro stays undefined.
      }
    }
    const platformInfo: PlatformInfo = { os: currentOS, arch: arch(), distro };

    if (typeof module.default !== 'function') {
      throw new Error(DEFAULT_EXPORT_ERROR);
    }

    ActiveContext.setStack(stack);
    ActiveContext.setPlatform(platformInfo);
    try {
      await module.default(app);
    } finally {
      ActiveContext.clear();
    }

    return { app, config: { name: 'functional-config' } };
  } finally {
    await cleanup();
  }
}

import { resolve, dirname, join } from 'node:path';
import { exists, mkdir, writeFile, rm } from 'node:fs/promises';
import { DottsSchema } from '../schema';
import { App, Stack } from './app';
import { PackageResource } from '../resources/package';
import { SymlinkResource } from '../resources/symlink';
import { FileResource } from '../resources/file';
import { DirectoryResource } from '../resources/directory';
import { ScriptResource, type ScriptResourceProps } from '../resources/script';
import { ActiveContext } from './context';
import type { PlatformInfo } from '../services/platform';
import { platform, arch } from 'node:os';
import * as publicApi from '../public';

export async function loadConfig(configPath: string): Promise<{ app: App; config: any }> {
  const absolutePath = resolve(configPath);

  if (!(await exists(absolutePath))) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  // Inject a virtual `node_modules/dotts` shim next to the user's config file.
  // This lets `import { pkg } from 'dotts'` work whether dotts is installed as
  // an npm package (existing node_modules) or run as a standalone compiled binary
  // with no node_modules at all.
  //
  // The shim reads exports from globalThis.__dotts_public_api__ which we set
  // below — this bridges the compiled binary's module registry to the user's
  // dynamically-imported config file.
  const configDir = dirname(absolutePath);
  const shimDir = join(configDir, 'node_modules', 'dotts');
  const shimFile = join(shimDir, 'index.js');
  const shimPkg = join(shimDir, 'package.json');

  const exportedNames = Object.keys(publicApi).filter(k => k !== '__esModule');
  const directShim = [
    'const __api__ = globalThis.__dotts_public_api__;',
    ...exportedNames.map(name => `export const ${name} = __api__['${name}'];`),
  ].join('\n');

  // Store the live public API on globalThis so the shim can access it
  (globalThis as any).__dotts_public_api__ = publicApi;

  let shimCreated = false;
  try {
    if (!(await exists(shimDir))) {
      await mkdir(shimDir, { recursive: true });
      await writeFile(shimFile, directShim, 'utf8');
      await writeFile(
        shimPkg,
        JSON.stringify({ name: 'dotts', version: '0.0.0', main: 'index.js', type: 'module' }),
        'utf8',
      );
      shimCreated = true;
    }

    const module = await import(absolutePath);

    const app = new App();
    const stack = new Stack(app, 'default');

    // Fetch platform info — detect distro from /etc/os-release on Linux so that
    // onDistro() guards work correctly at config evaluation time.
    const currentOS = platform();
    let distro: string | undefined;
    if (currentOS === 'linux') {
      try {
        const osRelease = await import('node:fs/promises').then(m => m.readFile('/etc/os-release', 'utf-8'));
        const match = osRelease.match(/^ID=(.*)$/m);
        if (match) distro = match[1]?.replace(/"/g, '').trim();
      } catch {
        // /etc/os-release not available — distro stays undefined
      }
    }
    const platformInfo: PlatformInfo = { os: currentOS, arch: arch(), distro };

    // Handle functional configuration (export default)
    if (typeof module.default === 'function') {
      ActiveContext.setStack(stack);
      ActiveContext.setPlatform(platformInfo);
      try {
        await module.default(app);
      } finally {
        ActiveContext.clear();
      }
      return { app, config: { name: 'functional-config' } };
    }

    // Handle legacy object-based configuration (export const config)
    if (!module.config) {
      throw new Error(
        `Configuration file must export a 'config' object or a default function: ${configPath}`,
      );
    }

    const result = DottsSchema.safeParse(module.config);

    if (!result.success) {
      const errorMsg = result.error.issues
        .map((e: any) => `${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Invalid configuration in ${configPath}:\n${errorMsg}`);
    }

    const config = result.data;

    for (const pkg of config.packages) {
      new PackageResource(stack, `pkg-${pkg.name}`, pkg);
    }

    for (const link of config.symlinks) {
      new SymlinkResource(stack, `link-${link.path}`, link);
    }

    for (const file of config.files) {
      new FileResource(stack, `file-${file.path}`, file);
    }

    for (const dir of config.directories) {
      new DirectoryResource(stack, `dir-${dir.path}`, dir);
    }

    for (const script of config.scripts) {
      new ScriptResource(stack, `script-${script.run.slice(0, 20)}`, script as ScriptResourceProps);
    }

    return { app, config };
  } finally {
    // Clean up the shim only if we created it — don't disturb pre-existing node_modules
    if (shimCreated) {
      await rm(shimDir, { recursive: true, force: true });
    }
  }
}
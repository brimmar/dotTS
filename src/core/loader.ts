import { resolve } from 'node:path';
import { exists } from 'node:fs/promises';
import { DottsSchema } from '../schema';
import { App, Stack } from './app';
import { PackageResource } from '../resources/package';
import { SymlinkResource } from '../resources/symlink';
import { FileResource } from '../resources/file';
import { DirectoryResource } from '../resources/directory';
import { ScriptResource } from '../resources/script';
import { ActiveContext } from './context';
import { PlatformService, PlatformServiceLive } from '../services/platform';
import { FileSystemLive } from '../services/fs';
import { Effect, Layer } from 'effect';

export async function loadConfig(configPath: string): Promise<{ app: App; config: any }> {
  const absolutePath = resolve(configPath);

  if (!(await exists(absolutePath))) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  const module = await import(absolutePath);
  
  const app = new App();
  const stack = new Stack(app, 'default');

  // Fetch platform info
  const platformInfo = await Effect.runPromise(
    Effect.provide(
      PlatformService.pipe(Effect.flatMap(s => s.get())),
      Layer.mergeAll(PlatformServiceLive, FileSystemLive)
    )
  );

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
    throw new Error(`Configuration file must export a 'config' object or a default function: ${configPath}`);
  }

  const result = DottsSchema.safeParse(module.config);
  
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
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
    new ScriptResource(stack, `script-${script.run.slice(0, 20)}`, script);
  }

  return { app, config };
}

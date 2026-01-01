import { resolve } from 'node:path';
import { exists } from 'node:fs/promises';
import { DottsSchema } from '../schema';
import { App, Stack } from './app';
import { PackageResource } from '../resources/package';
import { SymlinkResource } from '../resources/symlink';
import { FileResource } from '../resources/file';
import { DirectoryResource } from '../resources/directory';

export async function loadConfig(configPath: string): Promise<{ app: App; config: any }> {
  const absolutePath = resolve(configPath);

  if (!(await exists(absolutePath))) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  const module = await import(absolutePath);
  
  if (!module.config) {
    throw new Error(`Configuration file must export a 'config' object: ${configPath}`);
  }

  const result = DottsSchema.safeParse(module.config);
  
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid configuration in ${configPath}:\n${errorMsg}`);
  }

  const config = result.data;
  const app = new App();
  const stack = new Stack(app, 'default');

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

  return { app, config };
}
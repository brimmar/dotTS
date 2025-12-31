import { exists } from 'node:fs/promises';
import { DottsSchema } from '../schema';
import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { resolve } from 'node:path';

export async function dottsApply(configPath: string) {
  const absolutePath = resolve(configPath);

  if (!(await exists(absolutePath))) {
    throw new Error(`Configuration file not found: ${absolutePath}`);
  }

  // Dynamically import the dotts.ts file
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
  
  p.log.step(color.cyan(`Applying configuration: ${config.name}`));
  
  if (config.packages.length > 0) {
    p.log.info(color.yellow('Packages to install:'));
    config.packages.forEach(pkg => p.log.info(`  - ${pkg.name} (${pkg.manager})`));
  }

  if (config.symlinks.length > 0) {
    p.log.info(color.yellow('Symlinks to create:'));
    config.symlinks.forEach(link => p.log.info(`  - ${link.source} -> ${link.target}`));
  }

  if (config.files.length > 0) {
    p.log.info(color.yellow('Files to create:'));
    config.files.forEach(file => p.log.info(`  - ${file.path}`));
  }

  return config;
}
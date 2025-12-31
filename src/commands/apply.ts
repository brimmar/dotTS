import { exists } from 'node:fs/promises';
import { DottsSchema } from '../schema';
import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { resolve } from 'node:path';
import { Effect, Layer } from 'effect';
import { Runner } from '../core/runner';
import { App, Stack } from '../core/app';
import { FileResource } from '../resources/file';
import { SymlinkResource } from '../resources/symlink';
import { PackageResource } from '../resources/package';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { SecretManager, SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';

export interface ApplyOptions {
  dryRun?: boolean;
}

export async function dottsApply(configPath: string, options: ApplyOptions = {}) {
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
  
  p.log.step(color.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));

  // Convert old config format to new Component tree
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

  // Create Mock services if dry-run is enabled
  const FSLayer = options.dryRun 
    ? Layer.succeed(FileSystem, FileSystem.of({
        writeFile: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would write file: ${path}`))),
        readFile: () => Effect.succeed(''),
        exists: () => Effect.succeed(true),
        mkdir: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would create directory: ${path}`))),
        symlink: (target, path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would create symlink: ${path} -> ${target}`))),
      }))
    : FileSystemLive;

  const ExecLayer = options.dryRun
    ? Layer.succeed(SystemCommand, SystemCommand.of({
        run: (cmd) => Effect.sync(() => { p.log.info(color.gray(`[DRY RUN] Would execute: ${cmd}`)); return ''; }),
      }))
    : SystemCommandLive;

  const program = Effect.gen(function* (_) {
    const runner = yield* _(Runner);
    yield* _(runner.run(app));
  });

  const MainLive = program.pipe(
    Effect.provide(Runner.live),
    Effect.provide(FSLayer),
    Effect.provide(ExecLayer),
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive)
  );
  
  await Effect.runPromise(MainLive);

  return config;
}
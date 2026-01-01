import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { Effect, Layer } from 'effect';
import { Runner, RunnerLive } from '../core/runner';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { SecretManager, SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';
import { StateServiceLive } from '../services/state';
import { PlatformServiceLive } from '../services/platform';
import { TemplateServiceLive } from '../services/template';
import { loadConfig } from '../core/loader';

export interface ApplyOptions {
  dryRun?: boolean;
}

export async function dottsApply(configPath: string, options: ApplyOptions = {}) {
  const { app, config } = await loadConfig(configPath);
  
  p.log.step(color.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));

  // Create Mock services if dry-run is enabled
  const FSLayer = options.dryRun 
    ? Layer.succeed(FileSystem, FileSystem.of({
        writeFile: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would write file: ${path}`))),
        readFile: () => Effect.succeed(''),
        exists: () => Effect.succeed(true),
        mkdir: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would create directory: ${path}`))),
        symlink: (target, path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would create symlink: ${path} -> ${target}`))),
        rm: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would remove: ${path}`))),
        unlink: (path) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would unlink: ${path}`))),
        chmod: (path, mode) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would chmod: ${path} to ${mode}`))),
        chown: (path, uid, gid) => Effect.sync(() => p.log.info(color.gray(`[DRY RUN] Would chown: ${path} to ${uid}:${gid}`))),
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
    Effect.provide(RunnerLive),
    Effect.provide(StateServiceLive),
    Effect.provide(SecretManagerLive),
    Effect.provide(PlatformServiceLive),
    Effect.provide(TemplateServiceLive),
    Effect.provide(FSLayer),
    Effect.provide(SecretStoreLive),
    Effect.provide(ExecLayer),
  );
  
  await Effect.runPromise(MainLive);

  return config;
}
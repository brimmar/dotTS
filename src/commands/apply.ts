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
import { RemoteRepoService, RemoteRepoServiceLive } from '../services/remote-repo';
import { TempDirService, TempDirServiceLive } from '../services/temp-dir';
import { HttpServiceLive } from '../services/http';
import { loadConfig } from '../core/loader';
import { join } from 'node:path';

export interface ApplyOptions {
  dryRun?: boolean;
}

export async function dottsApply(configPath: string, options: ApplyOptions = {}) {
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
    const remoteRepo = yield* _(RemoteRepoService);
    const tempDir = yield* _(TempDirService);
    const runner = yield* _(Runner);

    let targetConfig = configPath;

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* _(remoteRepo.resolve(configPath));
      
      const confirmed = yield* _(Effect.promise(() => p.confirm({
        message: `Applying remote configuration from ${color.yellow(url)}. Do you trust this repository?`,
        initialValue: false,
      })));

      if (!confirmed || p.isCancel(confirmed)) {
        return yield* _(Effect.fail(new Error('Remote configuration apply cancelled by user.')));
      }

      return yield* _(tempDir.use((dir) => Effect.gen(function* (_) {
        const s = p.spinner();
        s.start(`Cloning ${url}...`);
        yield* _(remoteRepo.clone(url, dir));
        s.stop(`Cloned to temporary directory.`);

        const finalPath = join(dir, 'dotts.ts');
        const { app, config } = yield* _(Effect.promise(() => loadConfig(finalPath)));
        
        p.log.step(color.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
        yield* _(runner.run(app));
        return config;
      })));
    } else {
      const { app, config } = yield* _(Effect.promise(() => loadConfig(configPath)));
      p.log.step(color.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
      yield* _(runner.run(app));
      return config;
    }
  });

  const MainLayer = RunnerLive.pipe(
    Layer.provideMerge(RemoteRepoServiceLive),
    Layer.provideMerge(TempDirServiceLive),
    Layer.provideMerge(SecretManagerLive),
    Layer.provideMerge(PlatformServiceLive),
    Layer.provideMerge(StateServiceLive),
    Layer.provideMerge(TemplateServiceLive),
    Layer.provideMerge(HttpServiceLive),
    Layer.provideMerge(SecretStoreLive),
    Layer.provideMerge(ExecLayer),
    Layer.provideMerge(FSLayer)
  );
  
  return await Effect.runPromise(Effect.provide(program, MainLayer));
}

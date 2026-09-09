import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Effect, Layer } from 'effect';
import { Runner, RunnerLive } from '../core/runner';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { SecretManager, SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';
import { StateService, StateServiceLive, type AppState } from '../services/state';
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

/** Live reads; mutating methods log and do not touch disk. */
export function dryRunFileSystem(live: FileSystem): FileSystem {
  return FileSystem.of({
    readFile: (path, options) => live.readFile(path, options),
    exists: (path, options) => live.exists(path, options),
    writeFile: (path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would write file: ${path}`));
      }),
    writeFileBytes: (path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would write bytes: ${path}`));
      }),
    mkdir: (path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would create directory: ${path}`));
      }),
    symlink: (target, path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would create symlink: ${path} -> ${target}`));
      }),
    rm: (path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would remove: ${path}`));
      }),
    unlink: (path) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would unlink: ${path}`));
      }),
    chmod: (path, mode) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would chmod: ${path} to ${mode}`));
      }),
    chown: (path, uid, gid) =>
      Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would chown: ${path} to ${uid}:${gid}`));
      }),
  });
}

function dryRunSystemCommand(live: SystemCommand): SystemCommand {
  return SystemCommand.of({
    execFile: (file, args, options) => {
      if (options?.intent === 'read') {
        return live.execFile(file, args, options);
      }
      return Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would execute: ${file} ${args.join(' ')}`));
        return '';
      });
    },
    run: (command, options) => {
      if (options?.intent === 'read') {
        return live.run(command, options);
      }
      return Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would execute: ${command}`));
        return '';
      });
    },
  });
}

export async function dottsApply(configPath: string, options: ApplyOptions = {}) {
  const FSLayer = options.dryRun
    ? Layer.effect(
        FileSystem,
        Effect.gen(function* () {
          const live = yield* FileSystem;
          return dryRunFileSystem(live);
        }),
      ).pipe(Layer.provide(FileSystemLive.pipe(Layer.provide(SystemCommandLive))))
    : FileSystemLive;

  const ExecLayer = options.dryRun
    ? Layer.effect(
        SystemCommand,
        Effect.gen(function* () {
          const live = yield* SystemCommand;
          return dryRunSystemCommand(live);
        }),
      ).pipe(Layer.provide(SystemCommandLive))
    : SystemCommandLive;

  const StateLayer = options.dryRun
    ? Layer.effect(
        StateService,
        Effect.gen(function* () {
          const fs = yield* FileSystem;
          let statePath = join(process.cwd(), '.dotts/state.json');
          return StateService.of({
            setPath: (path) =>
              Effect.sync(() => {
                statePath = path;
              }),
            load: () =>
              Effect.gen(function* () {
                const exists = yield* fs.exists(statePath);
                if (!exists) return {};
                const content = yield* fs.readFile(statePath);
                return JSON.parse(content) as AppState;
              }),
            save: () => Effect.void,
          });
        }),
      )
    : StateServiceLive;

  const program = Effect.gen(function* (_) {
    const remoteRepo = yield* _(RemoteRepoService);
    const tempDir = yield* _(TempDirService);
    const runner = yield* _(Runner);

    let targetConfig = configPath;

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* _(remoteRepo.resolve(configPath));
      
      const confirmed = yield* _(Effect.promise(() => p.confirm({
        message: `Applying remote configuration from ${pc.yellow(url)}. Do you trust this repository?`,
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
        
        p.log.step(pc.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
        yield* _(runner.run(app));
        return config;
      })));
    } else {
      const { app, config } = yield* _(Effect.promise(() => loadConfig(configPath)));
      p.log.step(pc.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
      yield* _(runner.run(app));
      return config;
    }
  });

  const MainLayer = RunnerLive.pipe(
    Layer.provideMerge(RemoteRepoServiceLive),
    Layer.provideMerge(TempDirServiceLive),
    Layer.provideMerge(SecretManagerLive),
    Layer.provideMerge(PlatformServiceLive),
    Layer.provideMerge(StateLayer),
    Layer.provideMerge(TemplateServiceLive),
    Layer.provideMerge(HttpServiceLive),
    Layer.provideMerge(SecretStoreLive),
    Layer.provideMerge(ExecLayer),
    Layer.provideMerge(FSLayer.pipe(Layer.provideMerge(ExecLayer)))
  );
  
  return await Effect.runPromise(Effect.provide(program, MainLayer));
}

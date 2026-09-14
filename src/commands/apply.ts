import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Effect, Layer } from 'effect';
import { Runner, RunnerLive } from '../core/runner';
import { FileSystem, FileSystemLive } from '../services/fs';
import { DryRun } from '../services/dry-run';
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
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { flatten } from '../core/component';
import { checkPathPermission, setupSudoSession } from '../core/sudo';

export interface ApplyOptions {
  dryRun?: boolean;
  yes?: boolean;
}

/** Live reads; mutating methods log and do not touch disk. */
export function dryRunFileSystem(live: FileSystem): FileSystem {
  return FileSystem.of({
    readFile: (path, options) => live.readFile(path, options),
    exists: (path, options) => live.exists(path, options),
    writeFile: (path, _content, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would write file: ${path}`));
      }),
    writeFileBytes: (path, _content, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would write bytes: ${path}`));
      }),
    mkdir: (path, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would create directory: ${path}`));
      }),
    symlink: (target, path, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would create symlink: ${path} -> ${target}`));
      }),
    rm: (path, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would remove: ${path}`));
      }),
    rmdir: (path, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would rmdir: ${path}`));
      }),
    unlink: (path, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would unlink: ${path}`));
      }),
    chmod: (path, mode, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would chmod: ${path} to ${mode}`));
      }),
    chown: (path, uid, gid, options) =>
      Effect.sync(() => {
        checkPathPermission(path, options);
        p.log.info(pc.gray(`[DRY RUN] Would chown: ${path} to ${uid}:${gid}`));
      }),
  });
}

function dryRunSystemCommand(live: SystemCommand): SystemCommand {
  return SystemCommand.of({
    execFile: (file, args, options) => {
      if (options?.intent === 'read') {
        return live.execFile(file, args, { ...options, become: undefined });
      }
      return Effect.sync(() => {
        p.log.info(pc.gray(`[DRY RUN] Would execute: ${file} ${args.join(' ')}`));
        return '';
      });
    },
    run: (command, options) => {
      if (options?.intent === 'read') {
        return live.run(command, { ...options, become: undefined });
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
    const secretManager = yield* _(SecretManager);

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* _(remoteRepo.resolve(configPath));
      
      const shouldConfirm = !options.yes && process.env.DOTTS_YES !== '1';
      if (shouldConfirm) {
        const confirmed = yield* _(Effect.promise(() => p.confirm({
          message: `Applying remote configuration from ${pc.yellow(url)}. Do you trust this repository?`,
          initialValue: false,
        })));

        if (!confirmed || p.isCancel(confirmed)) {
          return yield* _(Effect.fail(new Error('Remote configuration apply cancelled by user.')));
        }
      }

      return yield* _(tempDir.use((dir) => Effect.gen(function* (_) {
        const s = p.spinner();
        s.start(`Cloning ${url}...`);
        yield* _(remoteRepo.clone(url, dir));
        s.stop(`Cloned to temporary directory.`);

        let finalPath = join(dir, 'dotts.ts');
        if (!existsSync(finalPath)) {
          if (existsSync(join(dir, 'dotts', 'dotts.ts'))) {
            finalPath = join(dir, 'dotts', 'dotts.ts');
          } else if (existsSync(join(dir, '.dotts', 'dotts.ts'))) {
            finalPath = join(dir, '.dotts', 'dotts.ts');
          }
        }

        const configDir = dirname(finalPath);
        yield* _(secretManager.setPaths({
          secretsFile: join(configDir, '.dotts', 'secrets.json'),
          masterKeyFile: join(homedir(), '.dotts_key'),
        }));

        const { app, config } = yield* _(Effect.promise(() => loadConfig(finalPath)));
        
        p.log.step(pc.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
        const rawResources = flatten(app);
        const sudoSession = yield* _(Effect.sync(() => setupSudoSession(rawResources, { dryRun: options.dryRun })));
        yield* _(
          Effect.acquireUseRelease(
            Effect.succeed(sudoSession),
            () => runner.run(app),
            (session) => Effect.sync(() => session.cleanup()),
          ),
        );
        return config;
      })));
    } else {
      const resolved = resolve(configPath);
      const configDir = dirname(resolved);
      yield* _(secretManager.setPaths({
        secretsFile: join(configDir, '.dotts', 'secrets.json'),
        masterKeyFile: join(homedir(), '.dotts_key'),
      }));

      const { app, config } = yield* _(Effect.promise(() => loadConfig(configPath)));
      p.log.step(pc.cyan(`Applying configuration: ${config.name}${options.dryRun ? ' (DRY RUN)' : ''}`));
      const rawResources = flatten(app);
      const sudoSession = yield* _(Effect.sync(() => setupSudoSession(rawResources, { dryRun: options.dryRun })));
      yield* _(
        Effect.acquireUseRelease(
          Effect.succeed(sudoSession),
          () => runner.run(app),
          (session) => Effect.sync(() => session.cleanup()),
        ),
      );
      return config;
    }
  });

  const RemoteRepoLayer = RemoteRepoServiceLive.pipe(Layer.provide(SystemCommandLive));
  const TempDirLayer = TempDirServiceLive.pipe(
    Layer.provide(FileSystemLive.pipe(Layer.provide(SystemCommandLive))),
  );

  const MainLayer = RunnerLive.pipe(
    Layer.provideMerge(RemoteRepoLayer),
    Layer.provideMerge(TempDirLayer),
    Layer.provideMerge(SecretManagerLive),
    Layer.provideMerge(PlatformServiceLive),
    Layer.provideMerge(StateLayer),
    Layer.provideMerge(TemplateServiceLive),
    Layer.provideMerge(HttpServiceLive),
    Layer.provideMerge(SecretStoreLive),
    Layer.provideMerge(ExecLayer),
    Layer.provideMerge(FSLayer.pipe(Layer.provideMerge(ExecLayer))),
    Layer.provideMerge(options.dryRun ? Layer.succeed(DryRun, true) : Layer.empty),
  );
  
  return await Effect.runPromise(Effect.provide(program, MainLayer));
}

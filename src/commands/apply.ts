import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Effect, Layer } from "effect";
import pc from "picocolors";
import { flatten } from "../core/component";
import { loadConfig } from "../core/loader";
import { Runner, RunnerLive } from "../core/runner";
import { checkPathPermission, setupSudoSession } from "../core/sudo";
import { DryRun } from "../services/dry-run";
import {
  SystemCommand,
  createSystemCommandLive,
} from "../services/exec";
import { FileSystem, FileSystemLive } from "../services/fs";
import { HttpServiceLive } from "../services/http";
import { PlatformServiceLive } from "../services/platform";
import {
  RemoteRepoService,
  RemoteRepoServiceLive,
} from "../services/remote-repo";
import { SecretStoreLive } from "../services/secrets";
import { SecretManager, SecretManagerLive } from "../services/secrets-manager";
import {
  type AppState,
  StateService,
  StateServiceLive,
} from "../services/state";
import { TempDirService, TempDirServiceLive } from "../services/temp-dir";
import { TemplateServiceLive } from "../services/template";
import {
  ValidationService,
  ValidationServiceLive,
} from "../services/validation";

export interface ApplyOptions {
  dryRun?: boolean;
  yes?: boolean;
  verbose?: boolean;
  json?: boolean;
}

export interface ApplyResult {
  success: boolean;
  command: "apply";
  config: string;
  dryRun: boolean;
  summary: {
    created: number;
    updated: number;
    deleted: number;
    converged: number;
    durationSeconds: number;
  };
  resources: Array<{
    id: string;
    kind: string;
    status: "created" | "updated" | "converged" | "deleted";
    durationSeconds?: number;
  }>;
}

/** Live reads; mutating methods log and do not touch disk. */
export function dryRunFileSystem(
  live: FileSystem,
  options?: { json?: boolean },
): FileSystem {
  const log = (msg: string) => {
    if (!options?.json) {
      p.log.info(pc.gray(msg));
    }
  };
  return FileSystem.of({
    readFile: (path, opt) => live.readFile(path, opt),
    exists: (path, opt) => live.exists(path, opt),
    writeFile: (path, _content, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would write file: ${path}`);
      }),
    writeFileBytes: (path, _content, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would write bytes: ${path}`);
      }),
    mkdir: (path, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would create directory: ${path}`);
      }),
    symlink: (target, path, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would create symlink: ${path} -> ${target}`);
      }),
    rm: (path, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would remove: ${path}`);
      }),
    rmdir: (path, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would rmdir: ${path}`);
      }),
    unlink: (path, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would unlink: ${path}`);
      }),
    chmod: (path, mode, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would chmod: ${path} to ${mode}`);
      }),
    chown: (path, uid, gid, opt) =>
      Effect.sync(() => {
        checkPathPermission(path, opt);
        log(`[DRY RUN] Would chown: ${path} to ${uid}:${gid}`);
      }),
  });
}

function dryRunSystemCommand(
  live: SystemCommand,
  verbose?: boolean,
  json?: boolean,
): SystemCommand {
  const log = (msg: string) => {
    if (!json) {
      p.log.info(pc.gray(msg));
    }
  };
  return SystemCommand.of({
    execFile: (file, args, options) => {
      if (options?.intent === "read") {
        return live.execFile(file, args, { ...options, become: undefined });
      }
      return Effect.sync(() => {
        log(`[DRY RUN] Would execute: ${file} ${args.join(" ")}`);
        if (verbose && options?.cwd && !json) {
          p.log.info(pc.dim(`          cwd: ${options.cwd}`));
        }
        return "";
      });
    },
    run: (command, options) => {
      if (options?.intent === "read") {
        return live.run(command, { ...options, become: undefined });
      }
      return Effect.sync(() => {
        log(`[DRY RUN] Would run: ${command}`);
        if (verbose && options?.cwd && !json) {
          p.log.info(pc.dim(`          cwd: ${options.cwd}`));
        }
        return "";
      });
    },
  });
}

export async function dottsApply(
  configPath: string,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const BaseExecLayer = createSystemCommandLive({ verbose: options.verbose });

  const FSLayer = options.dryRun
    ? Layer.effect(
        FileSystem,
        Effect.gen(function* () {
          const live = yield* FileSystem;
          return dryRunFileSystem(live, { json: options.json });
        }),
      ).pipe(Layer.provide(FileSystemLive.pipe(Layer.provide(BaseExecLayer))))
    : FileSystemLive;

  const ExecLayer = options.dryRun
    ? Layer.effect(
        SystemCommand,
        Effect.gen(function* () {
          const live = yield* SystemCommand;
          return dryRunSystemCommand(live, options.verbose, options.json);
        }),
      ).pipe(Layer.provide(BaseExecLayer))
    : BaseExecLayer;

  const StateLayer = options.dryRun
    ? Layer.effect(
        StateService,
        Effect.gen(function* () {
          const fs = yield* FileSystem;
          let statePath = join(process.cwd(), ".dotts/state.json");
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
    const validator = yield* _(ValidationService);

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* _(remoteRepo.resolve(configPath));

      const shouldConfirm = !options.yes && process.env.DOTTS_YES !== "1";
      if (shouldConfirm) {
        const confirmed = yield* _(
          Effect.promise(() =>
            p.confirm({
              message: `Applying remote configuration from ${pc.yellow(url)}. Do you trust this repository?`,
              initialValue: false,
            }),
          ),
        );

        if (!confirmed || p.isCancel(confirmed)) {
          return yield* _(
            Effect.fail(
              new Error("Remote configuration apply cancelled by user."),
            ),
          );
        }
      }

      return yield* _(
        tempDir.use((dir) =>
          Effect.gen(function* (_) {
            if (!options.json) {
              const s = p.spinner();
              s.start(`Cloning ${url}...`);
              yield* _(remoteRepo.clone(url, dir));
              s.stop(`Cloned to temporary directory.`);
            } else {
              yield* _(remoteRepo.clone(url, dir));
            }

            let finalPath = join(dir, "dotts.ts");
            if (!existsSync(finalPath)) {
              if (existsSync(join(dir, "dotts", "dotts.ts"))) {
                finalPath = join(dir, "dotts", "dotts.ts");
              } else if (existsSync(join(dir, ".dotts", "dotts.ts"))) {
                finalPath = join(dir, ".dotts", "dotts.ts");
              }
            }

            const configDir = dirname(finalPath);
            yield* _(
              secretManager.setPaths({
                secretsFile: join(configDir, ".dotts", "vault"),
                masterKeyFile: join(homedir(), ".dotts_key"),
              }),
            );

            const { app, config } = yield* _(
              Effect.promise(() => loadConfig(finalPath)),
            );

            if (!options.json) {
              p.log.step(
                pc.cyan(
                  `Applying configuration: ${config.name}${options.dryRun ? " (DRY RUN)" : ""}`,
                ),
              );
            }
            yield* _(validator.validate(app));
            const rawResources = flatten(app);
            const sudoSession = yield* _(
              Effect.sync(() =>
                setupSudoSession(rawResources, { dryRun: options.dryRun }),
              ),
            );
            const report = yield* _(
              Effect.acquireUseRelease(
                Effect.succeed(sudoSession),
                () => runner.run(app, { silent: options.json }),
                (session) => Effect.sync(() => session.cleanup()),
              ),
            );
            return {
              success: true,
              command: "apply" as const,
              config: config.name,
              dryRun: Boolean(options.dryRun),
              summary: {
                created: report.created,
                updated: report.updated,
                deleted: report.deleted,
                converged: report.converged,
                durationSeconds: report.durationSeconds,
              },
              resources: report.resources,
            };
          }),
        ),
      );
    } else {
      const resolved = resolve(configPath);
      const configDir = dirname(resolved);
      yield* _(
        secretManager.setPaths({
          secretsFile: join(configDir, ".dotts", "vault"),
          masterKeyFile: join(homedir(), ".dotts_key"),
        }),
      );

      const { app, config } = yield* _(
        Effect.promise(() => loadConfig(configPath)),
      );
      if (!options.json) {
        p.log.step(
          pc.cyan(
            `Applying configuration: ${config.name}${options.dryRun ? " (DRY RUN)" : ""}`,
          ),
        );
      }
      yield* _(validator.validate(app));
      const rawResources = flatten(app);
      const sudoSession = yield* _(
        Effect.sync(() =>
          setupSudoSession(rawResources, { dryRun: options.dryRun }),
        ),
      );
      const report = yield* _(
        Effect.acquireUseRelease(
          Effect.succeed(sudoSession),
          () => runner.run(app, { silent: options.json }),
          (session) => Effect.sync(() => session.cleanup()),
        ),
      );
      return {
        success: true,
        command: "apply" as const,
        config: config.name,
        dryRun: Boolean(options.dryRun),
        summary: {
          created: report.created,
          updated: report.updated,
          deleted: report.deleted,
          converged: report.converged,
          durationSeconds: report.durationSeconds,
        },
        resources: report.resources,
      };
    }
  });

  const RemoteRepoLayer = RemoteRepoServiceLive.pipe(
    Layer.provide(BaseExecLayer),
  );
  const TempDirLayer = TempDirServiceLive.pipe(
    Layer.provide(FileSystemLive.pipe(Layer.provide(BaseExecLayer))),
  );

  const SecretManagerWithDeps = SecretManagerLive.pipe(
    Layer.provide(FSLayer),
    Layer.provide(SecretStoreLive),
  );
  const ValidationLayer = ValidationServiceLive.pipe(
    Layer.provide(SecretManagerWithDeps),
    Layer.provide(FSLayer),
  );

  const MainLayer = RunnerLive.pipe(
    Layer.provideMerge(RemoteRepoLayer),
    Layer.provideMerge(TempDirLayer),
    Layer.provideMerge(SecretManagerWithDeps),
    Layer.provideMerge(ValidationLayer),
    Layer.provideMerge(PlatformServiceLive),
    Layer.provideMerge(StateLayer),
    Layer.provideMerge(TemplateServiceLive),
    Layer.provideMerge(HttpServiceLive),
    Layer.provideMerge(SecretStoreLive),
    Layer.provideMerge(ExecLayer),
    Layer.provideMerge(FSLayer.pipe(Layer.provideMerge(ExecLayer))),
    Layer.provideMerge(
      options.dryRun ? Layer.succeed(DryRun, true) : Layer.empty,
    ),
  );

  return await Effect.runPromise(Effect.provide(program, MainLayer));
}

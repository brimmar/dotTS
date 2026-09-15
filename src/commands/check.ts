import { existsSync } from "node:fs";
import { exists } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Effect } from "effect";
import pc from "picocolors";
import { loadConfig } from "../core/loader";
import { SystemCommandLive } from "../services/exec";
import { FileSystemLive } from "../services/fs";
import { HttpServiceLive } from "../services/http";
import { PlatformServiceLive } from "../services/platform";
import {
  RemoteRepoService,
  RemoteRepoServiceLive,
} from "../services/remote-repo";
import { SecretStoreLive } from "../services/secrets";
import { SecretManager, SecretManagerLive } from "../services/secrets-manager";
import { TempDirService, TempDirServiceLive } from "../services/temp-dir";
import { TemplateServiceLive } from "../services/template";
import { type TypecheckDiagnostic, typecheckFile } from "../services/typecheck";
import {
  ValidationService,
  ValidationServiceLive,
} from "../services/validation";
import { dottsPrepare } from "./prepare";

function throwOnTypeErrors(
  diagnostics: TypecheckDiagnostic[],
  json = false,
): void {
  if (diagnostics.length === 0) return;
  if (!json) {
    for (const d of diagnostics) {
      p.log.error(pc.red(`${d.file}:${d.line}:${d.column}: ${d.message}`));
    }
  }
  const details = diagnostics
    .map((d) => `${d.file}:${d.line}:${d.column}: ${d.message}`)
    .join("\n");
  throw new Error(`Typecheck failed with ${diagnostics.length} error(s):\n${details}`);
}

async function typecheckProject(
  configPath: string,
  projectDir: string,
  writeTypesIfMissing: boolean,
  json = false,
): Promise<void> {
  const typesDir = join(projectDir, ".dotts", "types");
  if (writeTypesIfMissing && !(await exists(typesDir))) {
    await dottsPrepare(projectDir);
  }
  throwOnTypeErrors(
    typecheckFile({
      configPath: resolve(configPath),
      typesDir,
    }),
    json,
  );
}

export interface CheckOptions {
  json?: boolean;
}

export interface CheckResult {
  success: boolean;
  command: "check";
  config: string;
  valid: boolean;
}

export async function dottsCheck(
  configPath: string,
  options: CheckOptions = {},
): Promise<CheckResult> {
  const program = Effect.gen(function* () {
    const remoteRepo = yield* RemoteRepoService;
    const tempDir = yield* TempDirService;
    const validator = yield* ValidationService;

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* remoteRepo.resolve(configPath);

      return yield* tempDir.use((dir) =>
        Effect.gen(function* () {
          if (!options.json) {
            const s = p.spinner();
            s.start(`Cloning ${url}...`);
            yield* remoteRepo.clone(url, dir);
            s.stop(`Cloned to temporary directory.`);
          } else {
            yield* remoteRepo.clone(url, dir);
          }

          let finalPath = join(dir, "dotts.ts");
          if (!existsSync(finalPath)) {
            if (existsSync(join(dir, "dotts", "dotts.ts"))) {
              finalPath = join(dir, "dotts", "dotts.ts");
            } else if (existsSync(join(dir, ".dotts", "dotts.ts"))) {
              finalPath = join(dir, ".dotts", "dotts.ts");
            }
          }
          const sm = yield* SecretManager;
          const configDir = dirname(finalPath);
          const vaultCandidate = existsSync(join(dir, ".dotts", "vault"))
            ? join(dir, ".dotts", "vault")
            : join(configDir, ".dotts", "vault");
          yield* sm.setPaths({
            secretsFile: vaultCandidate,
            masterKeyFile: join(homedir(), ".dotts_key"),
          });
          yield* Effect.promise(() =>
            typecheckProject(finalPath, dir, true, options.json),
          );
          const { app, config } = yield* Effect.promise(() =>
            loadConfig(finalPath),
          );

          if (!options.json) {
            p.log.step(pc.cyan(`Checking remote configuration: ${config.name}`));
          }
          yield* validator.validate(app);
          return config;
        }),
      );
    } else {
      const absolutePath = resolve(configPath);
      const sm = yield* SecretManager;
      yield* sm.setPaths({
        secretsFile: join(dirname(absolutePath), ".dotts", "vault"),
        masterKeyFile: join(homedir(), ".dotts_key"),
      });
      yield* Effect.promise(() =>
        typecheckProject(
          absolutePath,
          dirname(absolutePath),
          false,
          options.json,
        ),
      );
      const { app, config } = yield* Effect.promise(() =>
        loadConfig(configPath),
      );
      if (!options.json) {
        p.log.step(pc.cyan(`Checking configuration: ${config.name}`));
      }
      yield* validator.validate(app);
      return config;
    }
  });

  const MainLive = program.pipe(
    Effect.provide(ValidationServiceLive),
    Effect.provide(RemoteRepoServiceLive),
    Effect.provide(TempDirServiceLive),
    Effect.provide(SecretManagerLive),
    Effect.provide(PlatformServiceLive),
    Effect.provide(TemplateServiceLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(HttpServiceLive),
    Effect.provide(SystemCommandLive),
  );
  try {
    const config = await Effect.runPromise(MainLive);
    if (!options.json) {
      p.log.success(pc.green("Configuration is valid!"));
    }
    return {
      success: true,
      command: "check",
      config: config.name,
      valid: true,
    };
  } catch (error) {
    if (!options.json) {
      p.log.error(pc.red(`Validation failed: ${String(error)}`));
    }
    throw error;
  }
}

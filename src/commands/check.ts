import * as p from '@clack/prompts';
import { Effect, Layer } from 'effect';
import { exists } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../core/loader';
import { SystemCommandLive } from '../services/exec';
import { FileSystemLive } from '../services/fs';
import { HttpServiceLive } from '../services/http';
import { PlatformServiceLive } from '../services/platform';
import { RemoteRepoService, RemoteRepoServiceLive } from '../services/remote-repo';
import { SecretStoreLive } from '../services/secrets';
import { SecretManagerLive } from '../services/secrets-manager';
import { TempDirService, TempDirServiceLive } from '../services/temp-dir';
import { TemplateServiceLive } from '../services/template';
import { type TypecheckDiagnostic, typecheckFile } from '../services/typecheck';
import { ValidationService, ValidationServiceLive } from '../services/validation';
import { dottsPrepare } from './prepare';

function throwOnTypeErrors(diagnostics: TypecheckDiagnostic[]): void {
  if (diagnostics.length === 0) return;
  for (const d of diagnostics) {
    p.log.error(pc.red(`${d.file}:${d.line}:${d.column}: ${d.message}`));
  }
  throw new Error(`Typecheck failed with ${diagnostics.length} error(s)`);
}

async function typecheckProject(configPath: string, projectDir: string, writeTypesIfMissing: boolean): Promise<void> {
  const typesDir = join(projectDir, '.dotts', 'types');
  if (writeTypesIfMissing && !(await exists(typesDir))) {
    await dottsPrepare(projectDir);
  }
  throwOnTypeErrors(
    typecheckFile({
      configPath: resolve(configPath),
      typesDir,
    }),
  );
}

export async function dottsCheck(configPath: string) {
  const program = Effect.gen(function* () {
    const remoteRepo = yield* RemoteRepoService;
    const tempDir = yield* TempDirService;
    const validator = yield* ValidationService;

    if (remoteRepo.isRemote(configPath)) {
      const url = yield* remoteRepo.resolve(configPath);

      return yield* tempDir.use((dir) => Effect.gen(function* () {
        const s = p.spinner();
        s.start(`Cloning ${url}...`);
        yield* remoteRepo.clone(url, dir);
        s.stop(`Cloned to temporary directory.`);

        const finalPath = join(dir, 'dotts.ts');
        yield* Effect.promise(() => typecheckProject(finalPath, dir, true));
        const { app, config } = yield* Effect.promise(() => loadConfig(finalPath));

        p.log.step(pc.cyan(`Checking remote configuration: ${config.name}`));
        yield* validator.validate(app);
        return config;
      }));
    } else {
      const absolutePath = resolve(configPath);
      yield* Effect.promise(() => typecheckProject(absolutePath, dirname(absolutePath), false));
      const { app, config } = yield* Effect.promise(() => loadConfig(configPath));
      p.log.step(pc.cyan(`Checking configuration: ${config.name}`));
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
    Effect.provide(SystemCommandLive)
  );
  try {
    const config = await Effect.runPromise(MainLive);
    p.log.success(pc.green('Configuration is valid!'));
    return config;
  } catch (error) {
    p.log.error(pc.red(`Validation failed: ${String(error)}`));
    throw error;
  }
}
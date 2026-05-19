import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { Effect, Layer } from 'effect';
import { ValidationService, ValidationServiceLive } from '../services/validation';
import { FileSystemLive } from '../services/fs';
import { SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';
import { PlatformServiceLive } from '../services/platform';
import { TemplateServiceLive } from '../services/template';
import { RemoteRepoService, RemoteRepoServiceLive } from '../services/remote-repo';
import { TempDirService, TempDirServiceLive } from '../services/temp-dir';
import { HttpServiceLive } from '../services/http';
import { SystemCommandLive } from '../services/exec';
import { loadConfig } from '../core/loader';
import { join } from 'node:path';

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
        const { app, config } = yield* Effect.promise(() => loadConfig(finalPath));

        p.log.step(color.cyan(`Checking remote configuration: ${config.name}`));
        yield* validator.validate(app);
        return config;
      }));
    } else {
      const { app, config } = yield* Effect.promise(() => loadConfig(configPath));
      p.log.step(color.cyan(`Checking configuration: ${config.name}`));
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
    p.log.success(color.green('Configuration is valid!'));
    return config;
  } catch (error) {
    p.log.error(color.red(`Validation failed: ${String(error)}`));
    throw error;
  }
}
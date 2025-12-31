import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { Effect, Layer } from 'effect';
import { ValidationService, ValidationServiceLive } from '../services/validation';
import { FileSystemLive } from '../services/fs';
import { SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';
import { loadConfig } from '../core/loader';

export async function dottsCheck(configPath: string) {
  const { app, config } = await loadConfig(configPath);
  
  p.log.step(color.cyan(`Checking configuration: ${config.name}`));

  const program = Effect.gen(function* () {
    const validator = yield* ValidationService;
    yield* validator.validate(app);
  });

  const MainLive = program.pipe(
    Effect.provide(ValidationServiceLive),
    Effect.provide(SecretManagerLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SecretStoreLive)
  );
  
  try {
    await Effect.runPromise(MainLive);
    p.log.success(color.green('Configuration is valid!'));
  } catch (error) {
    p.log.error(color.red(`Validation failed: ${String(error)}`));
    throw error;
  }

  return config;
}

import { Effect, Layer } from 'effect';
import { SecretManager, SecretManagerLive } from '../services/secrets-manager';
import { SecretStoreLive } from '../services/secrets';
import { FileSystemLive } from '../services/fs';
import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { SystemCommandLive } from '../services/exec';

export async function dottsSecretSet(name: string, value: string) {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    yield* _(sm.set(name, value));
    p.log.success(color.green(`Secret '${name}' set successfully.`));
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive)
  );

  await Effect.runPromise(runnable);
}

export async function dottsSecretList() {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    const secrets = yield* _(sm.list());
    
    if (secrets.length === 0) {
      p.log.info('No secrets found.');
      return;
    }

    p.log.info(color.cyan('Configured secrets:'));
    secrets.forEach(s => p.log.info(`  - ${s} (********)`));
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive)
  );

  await Effect.runPromise(runnable);
}

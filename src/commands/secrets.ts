import * as p from "@clack/prompts";
import { Effect } from "effect";
import pc from "picocolors";
import { SystemCommandLive } from "../services/exec";
import { FileSystemLive } from "../services/fs";
import { SecretStoreLive } from "../services/secrets";
import { SecretManager, SecretManagerLive } from "../services/secrets-manager";

export async function dottsSecretSet(name: string, value: string) {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    yield* _(sm.set(name, value));
    p.log.success(pc.green(`Secret '${name}' set successfully.`));
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive),
  );

  await Effect.runPromise(runnable);
}

export async function dottsSecretList() {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    const secrets = yield* _(sm.list());

    if (secrets.length === 0) {
      p.log.info("No secrets found.");
      return;
    }

    p.log.info(pc.cyan("Configured secrets:"));
    for (const s of secrets) {
      p.log.info(`  - ${s} (********)`);
    }
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive),
  );

  await Effect.runPromise(runnable);
}

export async function dottsSecretRemove(name: string) {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    yield* _(sm.remove(name));
    p.log.success(pc.green(`Secret '${name}' removed successfully.`));
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive),
  );

  await Effect.runPromise(runnable);
}

export async function dottsSecretGet(name: string) {
  const program = Effect.gen(function* (_) {
    const sm = yield* _(SecretManager);
    const value = yield* _(sm.get(name));
    process.stdout.write(`${value}\n`);
  });

  const runnable = program.pipe(
    Effect.provide(SecretManagerLive),
    Effect.provide(SecretStoreLive),
    Effect.provide(FileSystemLive),
    Effect.provide(SystemCommandLive),
  );

  await Effect.runPromise(runnable);
}

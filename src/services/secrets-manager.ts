import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { SecretStore } from './secrets';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

export class SecretManager extends Context.Tag('SecretManager')<
  SecretManager,
  {
    readonly setPaths: (paths: { secretsFile: string; masterKeyFile: string }) => Effect.Effect<void>;
    readonly get: (name: string) => Effect.Effect<string, Error>;
    readonly set: (name: string, value: string) => Effect.Effect<void, Error>;
    readonly list: () => Effect.Effect<string[], Error>;
  }
>() {}

export const SecretManagerLive = Layer.effect(
  SecretManager,
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem);
    const store = yield* _(SecretStore);

    let secretsFile = join(process.cwd(), '.dotts/secrets.json');
    let masterKeyFile = join(homedir(), '.dotts_key');

    const getMasterKey = () =>
      Effect.gen(function* (_) {
        const exists = yield* _(fs.exists(masterKeyFile));
        if (!exists) {
          const newKey = randomBytes(32).toString('hex');
          yield* _(fs.mkdir(dirname(masterKeyFile)));
          yield* _(fs.writeFile(masterKeyFile, newKey));
          return newKey;
        }
        return yield* _(fs.readFile(masterKeyFile));
      });

    const loadSecrets = (key: string) =>
      Effect.gen(function* (_) {
        const exists = yield* _(fs.exists(secretsFile));
        if (!exists) return {};
        const content = yield* _(fs.readFile(secretsFile));
        return JSON.parse(content) as Record<string, string>;
      });

    const saveSecrets = (secrets: Record<string, string>) =>
      Effect.gen(function* (_) {
        yield* _(fs.mkdir(dirname(secretsFile)));
        yield* _(fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2)));
      });

    return SecretManager.of({
      setPaths: (paths) =>
        Effect.sync(() => {
          secretsFile = paths.secretsFile;
          masterKeyFile = paths.masterKeyFile;
        }),
      get: (name) =>
        Effect.gen(function* (_) {
          const key = yield* _(getMasterKey());
          const secrets = yield* _(loadSecrets(key));
          const encrypted = secrets[name];
          if (!encrypted) throw new Error(`Secret not found: ${name}`);
          return yield* _(store.decrypt(encrypted, key));
        }),
      set: (name, value) =>
        Effect.gen(function* (_) {
          const key = yield* _(getMasterKey());
          const secrets = yield* _(loadSecrets(key));
          const encrypted = yield* _(store.encrypt(value, key));
          secrets[name] = encrypted;
          yield* _(saveSecrets(secrets));
        }),
      list: () =>
        Effect.gen(function* (_) {
          const key = yield* _(getMasterKey());
          const secrets = yield* _(loadSecrets(key));
          return Object.keys(secrets);
        }),
    });
  })
);

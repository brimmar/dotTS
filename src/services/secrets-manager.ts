import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { SecretStore } from './secrets';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

export interface SecretManager {
  readonly setPaths: (paths: { secretsFile: string; masterKeyFile: string }) => Effect.Effect<void>;
  readonly get: (name: string) => Effect.Effect<string, Error>;
  readonly set: (name: string, value: string) => Effect.Effect<void, Error>;
  readonly list: () => Effect.Effect<string[], Error>;
  readonly remove: (name: string) => Effect.Effect<void, Error>;
}

export const SecretManager = Context.GenericTag<SecretManager>('SecretManager');

export const SecretManagerLive = Layer.effect(
  SecretManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const store = yield* SecretStore;

    let secretsFile = join(process.cwd(), '.dotts/secrets.json');
    let masterKeyFile = join(homedir(), '.dotts_key');

    const getMasterKey = () =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(masterKeyFile);
        if (!exists) {
          const newKey = randomBytes(32).toString('hex');
          yield* fs.mkdir(dirname(masterKeyFile));
          yield* fs.writeFile(masterKeyFile, newKey);
          return newKey;
        }
        return yield* fs.readFile(masterKeyFile);
      });

    const loadSecrets = (key: string) =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(secretsFile);
        if (!exists) return {};
        const content = yield* fs.readFile(secretsFile);
        return JSON.parse(content) as Record<string, string>;
      });

    const saveSecrets = (secrets: Record<string, string>) =>
      Effect.gen(function* () {
        yield* fs.mkdir(dirname(secretsFile));
        yield* fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2));
      });

    return SecretManager.of({
      setPaths: (paths) =>
        Effect.sync(() => {
          secretsFile = paths.secretsFile;
          masterKeyFile = paths.masterKeyFile;
        }),
      get: (name) =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets(key);
          const encrypted = secrets[name];
          if (!encrypted) throw new Error(`Secret not found: ${name}`);
          return yield* store.decrypt(encrypted, key);
        }),
      set: (name, value) =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets(key);
          const encrypted = yield* store.encrypt(value, key);
          secrets[name] = encrypted;
          yield* saveSecrets(secrets);
        }),
      list: () =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets(key);
          return Object.keys(secrets);
        }),
      remove: (name) =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets(key);
          if (secrets[name]) {
            delete secrets[name];
            yield* saveSecrets(secrets);
          }
        }),
    });
  })
);
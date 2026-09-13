import { Context, Effect, Layer } from 'effect';
import { FileSystem } from './fs';
import { decryptNew, SecretStore } from './secrets';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

const SECRET_FILE_MODE = 0o600;

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
          yield* fs.writeFile(masterKeyFile, newKey, { mode: SECRET_FILE_MODE });
          yield* fs.chmod(masterKeyFile, SECRET_FILE_MODE);
          return newKey;
        }
        const key = yield* fs.readFile(masterKeyFile);
        yield* fs.chmod(masterKeyFile, SECRET_FILE_MODE);
        return key;
      });

    const loadSecrets = () =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(secretsFile);
        if (!exists) return {};
        const content = yield* fs.readFile(secretsFile);
        return JSON.parse(content) as Record<string, string>;
      });

    const saveSecrets = (secrets: Record<string, string>) =>
      Effect.gen(function* () {
        yield* fs.mkdir(dirname(secretsFile));
        yield* fs.writeFile(secretsFile, JSON.stringify(secrets, null, 2), {
          mode: SECRET_FILE_MODE,
        });
        yield* fs.chmod(secretsFile, SECRET_FILE_MODE);
      });

    const migrateSecrets = (secrets: Record<string, string>, key: string) =>
      Effect.gen(function* () {
        let changed = false;
        const next: Record<string, string> = { ...secrets };

        for (const [name, encrypted] of Object.entries(secrets)) {
          const usesNewKey = yield* Effect.sync(() => {
            try {
              decryptNew(encrypted, key);
              return true;
            } catch {
              return false;
            }
          });

          if (usesNewKey) continue;

          // decryptNew failed: legacy candidate or corrupt blob. Leave corrupt entries as-is.
          const plaintext = yield* store.decrypt(encrypted, key).pipe(
            Effect.catchAll(() => Effect.succeed<string | undefined>(undefined))
          );
          if (plaintext === undefined) continue;

          next[name] = yield* store.encrypt(plaintext, key);
          changed = true;
        }

        if (changed) {
          yield* saveSecrets(next);
        }
        return next;
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
          const secrets = yield* loadSecrets();
          const migrated = yield* migrateSecrets(secrets, key);
          const encrypted = migrated[name];
          if (!encrypted) throw new Error(`Secret not found: ${name}`);
          return yield* store.decrypt(encrypted, key);
        }),
      set: (name, value) =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets();
          const migrated = yield* migrateSecrets(secrets, key);
          migrated[name] = yield* store.encrypt(value, key);
          yield* saveSecrets(migrated);
        }),
      list: () =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets();
          const migrated = yield* migrateSecrets(secrets, key);
          return Object.keys(migrated);
        }),
      remove: (name) =>
        Effect.gen(function* () {
          const key = yield* getMasterKey();
          const secrets = yield* loadSecrets();
          if (secrets[name]) {
            delete secrets[name];
            yield* saveSecrets(secrets);
          }
        }),
    });
  })
);

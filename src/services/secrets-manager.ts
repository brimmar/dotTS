import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { FileSystem } from "./fs";
import {
  formatVault,
  isVaultFormat,
  parseVault,
  SecretStore,
  VAULT_HEADER,
} from "./secrets";

const SECRET_FILE_MODE = 0o600;

export interface SecretManager {
  readonly setPaths: (paths: {
    secretsFile: string;
    masterKeyFile: string;
  }) => Effect.Effect<void>;
  readonly get: (name: string) => Effect.Effect<string, Error>;
  readonly set: (name: string, value: string) => Effect.Effect<void, Error>;
  readonly list: () => Effect.Effect<string[], Error>;
  readonly remove: (name: string) => Effect.Effect<void, Error>;
}

export const SecretManager = Context.GenericTag<SecretManager>("SecretManager");

interface LoadedSecrets {
  secrets: Record<string, string>;
  corruptLegacy: Record<string, string>;
  format: "vault" | "legacy";
}

export const SecretManagerLive = Layer.effect(
  SecretManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const store = yield* SecretStore;

    let customMasterKeyFile = false;
    let configuredSecretsFile = join(process.cwd(), ".dotts/vault");
    let masterKeyFile = join(homedir(), ".dotts_key");

    const resolveSecretsPath = () =>
      Effect.gen(function* () {
        if (yield* fs.exists(configuredSecretsFile)) {
          return configuredSecretsFile;
        }
        const dir = dirname(configuredSecretsFile);
        const candidates = ["vault", "secrets.vault", "secrets.json"];
        for (const candidate of candidates) {
          const candidatePath = join(dir, candidate);
          if (
            candidatePath !== configuredSecretsFile &&
            (yield* fs.exists(candidatePath))
          ) {
            return candidatePath;
          }
        }
        return configuredSecretsFile;
      });

    const getMasterKey = (targetFile: string) =>
      Effect.gen(function* () {
        if (process.env.DOTTS_KEY) {
          return process.env.DOTTS_KEY.trim();
        }
        let keyFile = masterKeyFile;
        let exists = yield* fs.exists(keyFile);
        if (!exists && !customMasterKeyFile) {
          const vaultPass1 = join(homedir(), ".vault-pass");
          const vaultPass2 = join(homedir(), ".vault_pass");
          if (yield* fs.exists(vaultPass1)) {
            keyFile = vaultPass1;
            exists = true;
          } else if (yield* fs.exists(vaultPass2)) {
            keyFile = vaultPass2;
            exists = true;
          }
        }
        if (!exists) {
          const secretsExist = yield* fs.exists(targetFile);
          if (secretsExist) {
            const content = (yield* fs.readFile(targetFile)).trim();
            if (content.length > 0) {
              return yield* Effect.fail(
                new Error(
                  `Master key file not found at ${masterKeyFile} (or ~/.vault-pass, ~/.vault_pass). Set DOTTS_KEY environment variable or create ${masterKeyFile} to decrypt secrets.`,
                ),
              );
            }
          }
          const newKey = randomBytes(32).toString("hex");
          yield* fs.mkdir(dirname(masterKeyFile));
          yield* fs.writeFile(masterKeyFile, newKey, {
            mode: SECRET_FILE_MODE,
          });
          yield* fs.chmod(masterKeyFile, SECRET_FILE_MODE);
          return newKey;
        }
        const key = yield* fs.readFile(keyFile);
        yield* fs.chmod(keyFile, SECRET_FILE_MODE);
        return key.trim();
      });

    const loadSecrets = (
      targetFile: string,
      key: string,
    ): Effect.Effect<LoadedSecrets, Error> =>
      Effect.gen(function* () {
        const exists = yield* fs.exists(targetFile);
        if (!exists) {
          return {
            secrets: {},
            corruptLegacy: {},
            format: "vault",
          };
        }

        const rawContent = yield* fs.readFile(targetFile);
        const content = rawContent.trim();
        if (!content) {
          return {
            secrets: {},
            corruptLegacy: {},
            format: "vault",
          };
        }

        if (isVaultFormat(content)) {
          const blob = parseVault(content);
          const decryptedJson = yield* store.decrypt(blob, key);
          let parsed: Record<string, string>;
          try {
            parsed = JSON.parse(decryptedJson);
          } catch (e) {
            return yield* Effect.fail(
              new Error(`Failed to parse decrypted vault JSON: ${String(e)}`),
            );
          }
          return {
            secrets: parsed,
            corruptLegacy: {},
            format: "vault",
          };
        }

        if (content.startsWith("{")) {
          let raw: Record<string, string>;
          try {
            raw = JSON.parse(content) as Record<string, string>;
          } catch (e) {
            return yield* Effect.fail(
              new Error(`Failed to parse legacy secrets JSON: ${String(e)}`),
            );
          }

          const secrets: Record<string, string> = {};
          const corruptLegacy: Record<string, string> = {};

          for (const [name, encryptedValue] of Object.entries(raw)) {
            const res = yield* store.decrypt(encryptedValue, key).pipe(
              Effect.map((val) => ({ ok: true as const, val })),
              Effect.catchAll(() =>
                Effect.succeed({ ok: false as const, val: undefined }),
              ),
            );
            if (res.ok && res.val !== undefined) {
              secrets[name] = res.val;
            } else {
              corruptLegacy[name] = encryptedValue;
            }
          }

          return {
            secrets,
            corruptLegacy,
            format: "legacy",
          };
        }

        return yield* Effect.fail(
          new Error(
            `Invalid secrets file format in ${targetFile}. Expected ${VAULT_HEADER} header or legacy JSON format.`,
          ),
        );
      });

    const saveSecrets = (
      targetFile: string,
      loaded: LoadedSecrets,
      key: string,
    ) =>
      Effect.gen(function* () {
        yield* fs.mkdir(dirname(targetFile));

        if (
          loaded.format === "legacy" &&
          Object.keys(loaded.corruptLegacy).length > 0
        ) {
          const raw: Record<string, string> = { ...loaded.corruptLegacy };
          for (const [k, v] of Object.entries(loaded.secrets)) {
            raw[k] = yield* store.encrypt(v, key);
          }
          yield* fs.writeFile(targetFile, JSON.stringify(raw, null, 2), {
            mode: SECRET_FILE_MODE,
          });
          yield* fs.chmod(targetFile, SECRET_FILE_MODE);
        } else {
          const json = JSON.stringify(loaded.secrets, null, 2);
          const encryptedBlob = yield* store.encrypt(json, key);
          const vaultContent = formatVault(encryptedBlob);
          yield* fs.writeFile(targetFile, vaultContent, {
            mode: SECRET_FILE_MODE,
          });
          yield* fs.chmod(targetFile, SECRET_FILE_MODE);
          loaded.format = "vault";
        }
      });

    const migrateIfLegacy = (
      targetFile: string,
      loaded: LoadedSecrets,
      key: string,
    ) =>
      Effect.gen(function* () {
        if (
          loaded.format === "legacy" &&
          Object.keys(loaded.corruptLegacy).length === 0 &&
          Object.keys(loaded.secrets).length > 0
        ) {
          yield* saveSecrets(targetFile, loaded, key);
        }
      });

    return SecretManager.of({
      setPaths: (paths) =>
        Effect.sync(() => {
          configuredSecretsFile = paths.secretsFile;
          masterKeyFile = paths.masterKeyFile;
          customMasterKeyFile = true;
        }),
      get: (name) =>
        Effect.gen(function* () {
          const targetFile = yield* resolveSecretsPath();
          const key = yield* getMasterKey(targetFile);
          const loaded = yield* loadSecrets(targetFile, key);
          yield* migrateIfLegacy(targetFile, loaded, key);
          if (name in loaded.corruptLegacy) {
            return yield* Effect.fail(
              new Error(`Decryption failed: corrupt secret ${name}`),
            );
          }
          const val = loaded.secrets[name];
          if (val !== undefined) {
            return val;
          }
          return yield* Effect.fail(new Error(`Secret not found: ${name}`));
        }),
      set: (name, value) =>
        Effect.gen(function* () {
          const targetFile = yield* resolveSecretsPath();
          const key = yield* getMasterKey(targetFile);
          const loaded = yield* loadSecrets(targetFile, key);
          delete loaded.corruptLegacy[name];
          loaded.secrets[name] = value;
          yield* saveSecrets(targetFile, loaded, key);
        }),
      list: () =>
        Effect.gen(function* () {
          const targetFile = yield* resolveSecretsPath();
          const key = yield* getMasterKey(targetFile);
          const loaded = yield* loadSecrets(targetFile, key);
          yield* migrateIfLegacy(targetFile, loaded, key);
          return [
            ...Object.keys(loaded.secrets),
            ...Object.keys(loaded.corruptLegacy),
          ];
        }),
      remove: (name) =>
        Effect.gen(function* () {
          const targetFile = yield* resolveSecretsPath();
          const key = yield* getMasterKey(targetFile);
          const loaded = yield* loadSecrets(targetFile, key);
          let changed = false;
          if (name in loaded.corruptLegacy) {
            delete loaded.corruptLegacy[name];
            changed = true;
          }
          if (name in loaded.secrets) {
            delete loaded.secrets[name];
            changed = true;
          }
          if (changed) {
            yield* saveSecrets(targetFile, loaded, key);
          }
        }),
    });
  }),
);

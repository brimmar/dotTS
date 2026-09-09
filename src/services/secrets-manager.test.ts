import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { SecretManager, SecretManagerLive } from './secrets-manager';
import { decryptNew, legacyKeyMaterial, SecretStoreLive } from './secrets';
import { FileSystem, FileSystemLive } from './fs';
import { SystemCommandLive } from './exec';
import { createCipheriv, randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';

function hexMasterKey(): string {
  return randomBytes(32).toString('hex');
}

function encryptWithLegacy(value: string, hex: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', legacyKeyMaterial(hex), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function encryptWithNew(value: string, hex: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function runManager<A>(program: Effect.Effect<A, Error, SecretManager>) {
  return Effect.runPromise(
    program.pipe(
      Effect.provide(SecretManagerLive),
      Effect.provide(SecretStoreLive),
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    )
  );
}

describe('SecretManager Service', () => {
  it('should set and get a secret', async () => {
    const testDir = join(tmpdir(), 'dotts-sm-test-' + Math.random().toString(36).slice(2));
    const secretsFile = join(testDir, '.dotts/secrets.json');
    const masterKeyFile = join(testDir, '.dotts_key');

    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);

      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));

      yield* _(sm.set('API_KEY', 'my-api-key'));
      const value = yield* _(sm.get('API_KEY'));

      return value;
    });

    const result = await runManager(program);
    expect(result).toBe('my-api-key');

    await rm(testDir, { recursive: true, force: true });
  });

  it('should chmod the master key and secrets file to 0o600 after set', async () => {
    const testDir = join(tmpdir(), 'dotts-sm-mode-' + Math.random().toString(36).slice(2));
    const secretsFile = join(testDir, '.dotts/secrets.json');
    const masterKeyFile = join(testDir, '.dotts_key');

    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));
      yield* _(sm.set('API_KEY', 'my-api-key'));
    });

    await runManager(program);

    const secretsStat = await stat(secretsFile);
    const keyStat = await stat(masterKeyFile);
    expect(secretsStat.mode & 0o777).toBe(0o600);
    expect(keyStat.mode & 0o777).toBe(0o600);

    await rm(testDir, { recursive: true, force: true });
  });

  it('should decrypt a legacy blob, rewrite it, and decrypt the rewrite with the new key only', async () => {
    const testDir = join(tmpdir(), 'dotts-sm-migrate-' + Math.random().toString(36).slice(2));
    const secretsFile = join(testDir, '.dotts/secrets.json');
    const masterKeyFile = join(testDir, '.dotts_key');
    const hexKey = hexMasterKey();
    const original = 'legacy-secret-value';
    const legacyBlob = encryptWithLegacy(original, hexKey);

    expect(() => decryptNew(legacyBlob, hexKey)).toThrow();

    await mkdir(join(testDir, '.dotts'), { recursive: true });
    await writeFile(masterKeyFile, hexKey);
    await writeFile(secretsFile, JSON.stringify({ LEGACY: legacyBlob }, null, 2));

    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));
      const first = yield* _(sm.get('LEGACY'));
      const second = yield* _(sm.get('LEGACY'));
      return { first, second };
    });

    const result = await runManager(program);
    expect(result.first).toBe(original);
    expect(result.second).toBe(original);

    const rewritten = JSON.parse(await readFile(secretsFile, 'utf8')) as Record<string, string>;
    expect(rewritten.LEGACY).not.toBe(legacyBlob);
    expect(decryptNew(rewritten.LEGACY as string, hexKey)).toBe(original);

    await rm(testDir, { recursive: true, force: true });
  });

  it('does not let a corrupt secret block listing or getting another', async () => {
    const testDir = join(tmpdir(), 'dotts-sm-corrupt-' + Math.random().toString(36).slice(2));
    const secretsFile = join(testDir, '.dotts/secrets.json');
    const masterKeyFile = join(testDir, '.dotts_key');
    const hexKey = hexMasterKey();
    const goodBlob = encryptWithNew('good-value', hexKey);
    const corruptBlob = 'not-a-valid-secret-blob';

    await mkdir(join(testDir, '.dotts'), { recursive: true });
    await writeFile(masterKeyFile, hexKey);
    await writeFile(secretsFile, JSON.stringify({ GOOD: goodBlob, BAD: corruptBlob }, null, 2));

    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));

      const names = yield* _(sm.list());
      const good = yield* _(sm.get('GOOD'));
      yield* _(sm.set('NEW', 'new-value'));
      const namesAfterSet = yield* _(sm.list());
      const created = yield* _(sm.get('NEW'));

      return { names, good, namesAfterSet, created };
    });

    const result = await runManager(program);
    expect(result.names.sort()).toEqual(['BAD', 'GOOD']);
    expect(result.good).toBe('good-value');
    expect(result.created).toBe('new-value');
    expect(result.namesAfterSet.sort()).toEqual(['BAD', 'GOOD', 'NEW']);

    const getBad = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));
      return yield* _(sm.get('BAD'));
    });
    await expect(runManager(getBad)).rejects.toThrow(/Decryption failed/);

    const onDisk = JSON.parse(await readFile(secretsFile, 'utf8')) as Record<string, string>;
    expect(onDisk.BAD).toBe(corruptBlob);

    await rm(testDir, { recursive: true, force: true });
  });

  it('writes master key and secrets file as 0o600 immediately after writeFile', async () => {
    const testDir = join(tmpdir(), 'dotts-sm-write-mode-' + Math.random().toString(36).slice(2));
    const secretsFile = join(testDir, '.dotts/secrets.json');
    const masterKeyFile = join(testDir, '.dotts_key');
    const modesAtWrite: number[] = [];

    const TrackingFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: (path, content, options) =>
        Effect.tryPromise({
          try: async () => {
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, content, { encoding: 'utf-8', mode: options?.mode });
            const s = await stat(path);
            modesAtWrite.push(s.mode & 0o777);
          },
          catch: (error) => new Error(String(error)),
        }),
      readFile: (path) =>
        Effect.tryPromise({
          try: () => readFile(path, 'utf-8'),
          catch: (error) => new Error(String(error)),
        }),
      exists: (path) =>
        Effect.tryPromise({
          try: async () => {
            try {
              await access(path);
              return true;
            } catch {
              return false;
            }
          },
          catch: (error) => new Error(String(error)),
        }),
      mkdir: (path) =>
        Effect.tryPromise({
          try: async () => {
            await mkdir(path, { recursive: true });
          },
          catch: (error) => new Error(String(error)),
        }),
      symlink: () => Effect.void,
      rm: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
    }));

    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));
      yield* _(sm.set('API_KEY', 'my-api-key'));
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(SecretManagerLive),
        Effect.provide(SecretStoreLive),
        Effect.provide(TrackingFS)
      )
    );

    expect(modesAtWrite.length).toBeGreaterThan(0);
    for (const mode of modesAtWrite) {
      expect(mode).toBe(0o600);
    }

    const secretsStat = await stat(secretsFile);
    const keyStat = await stat(masterKeyFile);
    expect(secretsStat.mode & 0o777).toBe(0o600);
    expect(keyStat.mode & 0o777).toBe(0o600);

    await rm(testDir, { recursive: true, force: true });
  });
});

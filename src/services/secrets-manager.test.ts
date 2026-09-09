import { describe, it, expect } from 'bun:test';
import { Effect } from 'effect';
import { SecretManager, SecretManagerLive } from './secrets-manager';
import { decryptNew, legacyKeyMaterial, SecretStoreLive } from './secrets';
import { FileSystemLive } from './fs';
import { SystemCommandLive } from './exec';
import { createCipheriv, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';

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
});

import { describe, it, expect } from 'bun:test';
import { Effect } from 'effect';
import { createCipheriv, randomBytes } from 'node:crypto';
import { decryptNew, legacyKeyMaterial, SecretStore, SecretStoreLive } from './secrets';

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

describe('SecretStore Service', () => {
  it('should encrypt and decrypt a value with a 64-char hex master key', async () => {
    const testKey = hexMasterKey();
    const program = Effect.gen(function* (_) {
      const secrets = yield* _(SecretStore);
      const original = 'my-super-secret-value';

      const encrypted = yield* _(secrets.encrypt(original, testKey));
      const decrypted = yield* _(secrets.decrypt(encrypted, testKey));

      return { original, encrypted, decrypted };
    });

    const runnable = Effect.provide(program, SecretStoreLive);
    const result = await Effect.runPromise(runnable);

    expect(result.original).toBe(result.decrypted);
    expect(result.encrypted).not.toBe(result.original);
    expect(decryptNew(result.encrypted, testKey)).toBe(result.original);
  });

  it('should decrypt a blob produced with the legacy padded key', async () => {
    const testKey = hexMasterKey();
    const original = 'legacy-secret-value';
    const legacyBlob = encryptWithLegacy(original, testKey);

    expect(() => decryptNew(legacyBlob, testKey)).toThrow();

    const program = Effect.gen(function* (_) {
      const secrets = yield* _(SecretStore);
      return yield* _(secrets.decrypt(legacyBlob, testKey));
    });

    const decrypted = await Effect.runPromise(Effect.provide(program, SecretStoreLive));
    expect(decrypted).toBe(original);
  });
});

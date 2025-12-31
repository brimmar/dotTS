import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { SecretStore, SecretStoreLive } from './secrets';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SecretStore Service', () => {
  const testDir = join(tmpdir(), 'dotts-secrets-test-' + Math.random().toString(36).slice(2));
  const testKey = 'test-master-key-1234567890123456'; // 32 chars for AES-256

  it('should encrypt and decrypt a value', async () => {
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
  });
});

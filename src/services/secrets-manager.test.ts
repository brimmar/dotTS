import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { SecretManager, SecretManagerLive } from './secrets-manager';
import { SecretStoreLive } from './secrets';
import { FileSystem, FileSystemLive } from './fs';
import { SystemCommandLive } from './exec';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm, mkdir } from 'node:fs/promises';

describe('SecretManager Service', () => {
  const testDir = join(tmpdir(), 'dotts-sm-test-' + Math.random().toString(36).slice(2));
  const secretsFile = join(testDir, '.dotts/secrets.json');
  const masterKeyFile = join(testDir, '.dotts_key');

  it('should set and get a secret', async () => {
    const program = Effect.gen(function* (_) {
      const sm = yield* _(SecretManager);
      
      // Setup paths for test
      yield* _(sm.setPaths({ secretsFile, masterKeyFile }));
      
      yield* _(sm.set('API_KEY', 'my-api-key'));
      const value = yield* _(sm.get('API_KEY'));
      
      return value;
    });

    const runnable = program.pipe(
      Effect.provide(SecretManagerLive),
      Effect.provide(SecretStoreLive),
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    );
    
    const result = await Effect.runPromise(runnable);
    expect(result).toBe('my-api-key');

    await rm(testDir, { recursive: true, force: true });
  });
});

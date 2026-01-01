import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { FileSystem, FileSystemLive } from './fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm, stat } from 'fs/promises';

describe('FileSystem Service', () => {
  const testDir = join(tmpdir(), 'dotts-fs-test-' + Math.random().toString(36).slice(2));

  it('should write and read a file', async () => {
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      const filePath = join(testDir, 'test.txt');
      
      yield* _(fs.mkdir(testDir));
      yield* _(fs.writeFile(filePath, 'hello world'));
      
      const exists = yield* _(fs.exists(filePath));
      const content = yield* _(fs.readFile(filePath));
      
      return { exists, content };
    });

    const runnable = Effect.provide(program, FileSystemLive);
    const result = await Effect.runPromise(runnable);
    
    expect(result.exists).toBe(true);
    expect(result.content).toBe('hello world');

    await rm(testDir, { recursive: true, force: true });
  });

  it('should change file permissions (chmod)', async () => {
    const filePath = join(testDir, 'chmod-test.txt');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(testDir));
      yield* _(fs.writeFile(filePath, 'test'));
      yield* _(fs.chmod(filePath, 0o600));
      return true;
    });

    await Effect.runPromise(Effect.provide(program, FileSystemLive));
    
    const s = await stat(filePath);
    expect(s.mode & 0o777).toBe(0o600);

    await rm(testDir, { recursive: true, force: true });
  });

  it('should change file ownership (chown)', async () => {
    const filePath = join(testDir, 'chown-test.txt');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(testDir));
      yield* _(fs.writeFile(filePath, 'test'));
      yield* _(fs.chown(filePath, process.getuid!(), process.getgid!()));
      return true;
    });

    await Effect.runPromise(Effect.provide(program, FileSystemLive));
    
    await rm(testDir, { recursive: true, force: true });
  });
});
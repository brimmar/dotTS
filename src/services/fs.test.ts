import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { FileSystem, FileSystemLive } from './fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';

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
});

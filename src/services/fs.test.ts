import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'fs';
import { rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Effect, Layer } from 'effect';
import { FileSystem, FileSystemLive } from './fs';
import { SystemCommand, SystemCommandLive } from './exec';

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

    const runnable = program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    );
    const result = await Effect.runPromise(runnable);
    
    expect(result.exists).toBe(true);
    expect(result.content).toBe('hello world');

    await rm(testDir, { recursive: true, force: true });
  });

  it('should write binary bytes including null and 0xFF', async () => {
    const filePath = join(testDir, 'binary.bin');
    const bytes = new Uint8Array([0, 1, 2, 255]);

    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(testDir));
      yield* _(fs.writeFileBytes(filePath, bytes));
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    ));

    const got = new Uint8Array(readFileSync(filePath));
    expect(Array.from(got)).toEqual([0, 1, 2, 255]);

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

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    ));
    
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

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    ));
    
    await rm(testDir, { recursive: true, force: true });
  });

  it('should write bytes with become via 0o600 temp, quoted cp, then unlink', async () => {
    const calls: string[] = [];
    let seenMode: number | undefined;
    let seenTemp: string | undefined;

    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) =>
          Effect.sync(() => {
            calls.push(command);
            const match = /^cp '([^']+)' '(.+)'$/.exec(command);
            if (match?.[1]) {
              seenTemp = match[1];
              seenMode = statSync(seenTemp).mode & 0o777;
            }
            return '';
          }),
      }),
    );

    const filePath = join(testDir, 'become.bin');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.mkdir(testDir);
      yield* fs.writeFileBytes(filePath, new Uint8Array([0, 255]), { become: true });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.startsWith('cp ')).toBe(true);
    expect(calls[0]?.includes(filePath)).toBe(true);
    expect(seenMode).toBe(0o600);
    if (!seenTemp) {
      throw new Error('expected cp of a temp path');
    }
    expect(existsSync(seenTemp)).toBe(false);
  });
});

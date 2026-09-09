import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'fs';
import { rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import { Effect, Layer } from 'effect';
import { FileSystem, FileSystemLive } from './fs';
import { SystemCommand, SystemCommandLive, buildSudoArgs } from './exec';

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

  it('should write a file with the given mode immediately', async () => {
    const filePath = join(testDir, 'mode-write.txt');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(testDir));
      yield* _(fs.writeFile(filePath, 'secret', { mode: 0o600 }));
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

  it('should create a symlink with become via ln argv', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          calls.push({ file, args });
          return Effect.succeed('');
        },
      }),
    );

    const linkPath = join(testDir, 'the-link');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.symlink('/the-target', linkPath, { become: true });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    expect(calls).toEqual([
      { file: 'mkdir', args: ['-p', '--', dirname(linkPath)] },
      { file: 'ln', args: ['-sf', '--', '/the-target', linkPath] },
    ]);
  });

  it('should check exists with become via test -e without --', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          calls.push({ file, args });
          return Effect.succeed('');
        },
      }),
    );

    const filePath = join(testDir, 'maybe-there');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      return yield* fs.exists(filePath, { become: true });
    });

    const exists = await Effect.runPromise(
      program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)),
    );

    expect(calls).toEqual([{ file: 'test', args: ['-e', filePath] }]);
    expect(calls[0]?.args.includes('--')).toBe(false);
    expect(exists).toBe(true);
  });

  it('should write a file with become via 0o600 temp, root install -m, then unlink', async () => {
    const calls: { file: string; args: string[]; become?: boolean | string }[] = [];
    let seenMode: number | undefined;
    let seenTemp: string | undefined;

    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args, opts) => {
          calls.push({ file, args, become: opts?.become });
          if (file === 'install') {
            const dash = args.indexOf('--');
            const temp = dash >= 0 ? args[dash + 1] : undefined;
            if (temp) {
              seenTemp = temp;
              seenMode = statSync(seenTemp).mode & 0o777;
            }
          }
          return Effect.succeed('');
        },
      }),
    );

    const filePath = join(testDir, 'become.txt');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.writeFile(filePath, 'secret', { become: true });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe('install');
    expect(calls[0]?.become).toBe(true);
    expect(seenMode).toBe(0o600);
    if (!seenTemp) {
      throw new Error('expected install of a temp path');
    }
    expect(calls[0]?.args).toEqual(['-m', '644', '--', seenTemp, filePath]);
    expect(seenTemp.startsWith(join(tmpdir(), 'dotts-'))).toBe(true);
    expect(basename(seenTemp)).toBe('file');
    expect(existsSync(seenTemp)).toBe(false);
    expect(existsSync(dirname(seenTemp))).toBe(false);
  });

  it('should write bytes with become via 0o600 temp, root install -m, then unlink', async () => {
    const calls: { file: string; args: string[]; become?: boolean | string }[] = [];
    let seenMode: number | undefined;
    let seenTemp: string | undefined;

    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args, opts) => {
          calls.push({ file, args, become: opts?.become });
          if (file === 'install') {
            const dash = args.indexOf('--');
            const temp = dash >= 0 ? args[dash + 1] : undefined;
            if (temp) {
              seenTemp = temp;
              seenMode = statSync(seenTemp).mode & 0o777;
            }
          }
          return Effect.succeed('');
        },
      }),
    );

    const filePath = join(testDir, 'become.bin');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.writeFileBytes(filePath, new Uint8Array([0, 255]), { become: true });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe('install');
    expect(calls[0]?.become).toBe(true);
    expect(seenMode).toBe(0o600);
    if (!seenTemp) {
      throw new Error('expected install of a temp path');
    }
    expect(calls[0]?.args).toEqual(['-m', '644', '--', seenTemp, filePath]);
    expect(seenTemp.startsWith(join(tmpdir(), 'dotts-'))).toBe(true);
    expect(basename(seenTemp)).toBe('file');
    expect(existsSync(seenTemp)).toBe(false);
    expect(existsSync(dirname(seenTemp))).toBe(false);
  });

  it('should copy as root then chown when become is a username', async () => {
    const calls: { file: string; args: string[]; become?: boolean | string }[] = [];

    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args, opts) => {
          calls.push({ file, args, become: opts?.become });
          return Effect.succeed('');
        },
      }),
    );

    const filePath = join(testDir, 'alice.txt');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.writeFile(filePath, 'secret', { become: 'alice' });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    const install = calls[0];
    if (!install || install.file !== 'install') {
      throw new Error('expected install of a temp path');
    }
    const temp = install.args[3];
    if (!temp) {
      throw new Error('expected install of a temp path');
    }
    expect(install.args).toEqual(['-m', '644', '--', temp, filePath]);
    expect(install.become).toBe(true);
    expect(buildSudoArgs(install.file, install.args, install.become)).toEqual({
      file: 'sudo',
      args: ['--', 'install', '-m', '644', '--', temp, filePath],
    });
    expect(calls[1]).toEqual({ file: 'chown', args: ['alice:', '--', filePath], become: true });
    expect(buildSudoArgs('chown', ['alice:', '--', filePath], calls[1]?.become)).toEqual({
      file: 'sudo',
      args: ['--', 'chown', 'alice:', '--', filePath],
    });
    expect(calls).toHaveLength(2);
    expect(temp.startsWith(join(tmpdir(), 'dotts-'))).toBe(true);
    expect(basename(temp)).toBe('file');
    expect(existsSync(temp)).toBe(false);
    expect(existsSync(dirname(temp))).toBe(false);
  });

  it('should install dest with the requested mode in one privileged step', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          calls.push({ file, args });
          return Effect.succeed('');
        },
      }),
    );

    const filePath = join(testDir, 'mode.txt');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.writeFile(filePath, 'secret', { become: true, mode: 0o600 });
    });

    await Effect.runPromise(program.pipe(Effect.provide(FileSystemLive), Effect.provide(MockExec)));

    expect(calls[0]?.file).toBe('install');
    expect(calls[0]?.args[0]).toBe('-m');
    expect(calls[0]?.args[1]).toBe('600');
    expect(calls[0]?.args[2]).toBe('--');
    expect(calls[0]?.args[4]).toBe(filePath);
    expect(calls).toHaveLength(1);
  });

  it('should pass mode to NodeFS.writeFile when set without become', async () => {
    const filePath = join(testDir, 'no-become-mode.txt');
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      yield* fs.mkdir(testDir);
      yield* fs.writeFile(filePath, 'secret', { mode: 0o600 });
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(FileSystemLive), Effect.provide(SystemCommandLive)),
    );

    const s = await stat(filePath);
    expect(s.mode & 0o777).toBe(0o600);

    await rm(testDir, { recursive: true, force: true });
  });
});

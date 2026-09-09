import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'fs';
import { rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, dirname, join, resolve } from 'path';
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

  it('should rmdir an empty directory and leave a non-empty one', async () => {
    const emptyDir = join(testDir, 'empty');
    const fullDir = join(testDir, 'full');
    const keep = join(fullDir, 'keep.txt');

    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(emptyDir));
      yield* _(fs.mkdir(fullDir));
      yield* _(fs.writeFile(keep, 'stay'));
      yield* _(fs.rmdir(emptyDir));
      yield* _(fs.rmdir(fullDir));
      const emptyGone = yield* _(fs.exists(emptyDir));
      const fullStays = yield* _(fs.exists(fullDir));
      const keepStays = yield* _(fs.exists(keep));
      return { emptyGone, fullStays, keepStays };
    });

    const result = await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    ));

    expect(result.emptyGone).toBe(false);
    expect(result.fullStays).toBe(true);
    expect(result.keepStays).toBe(true);

    await rm(testDir, { recursive: true, force: true });
  });

  it('should rmdir with become via rmdir argv', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: (file, args) => {
        calls.push({ file, args });
        return Effect.succeed('');
      },
    }));

    const target = join(testDir, 'some dir');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.rmdir(target, { become: true }));
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(MockExec),
    ));

    expect(calls).toEqual([{ file: 'rmdir', args: [resolve(target)] }]);
  });

  it('should ignore ENOENT and ENOTEMPTY on become rmdir', async () => {
    const MockExec = (message: string) => Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: () => Effect.fail(new Error(message)),
    }));

    const rmdirBecome = (message: string) => {
      const program = Effect.gen(function* (_) {
        const fs = yield* _(FileSystem);
        yield* _(fs.rmdir(join(testDir, 'gone'), { become: true }));
      });
      return Effect.runPromise(program.pipe(
        Effect.provide(FileSystemLive),
        Effect.provide(MockExec(message)),
      ));
    };

    await rmdirBecome('ENOENT: no such file or directory');
    await rmdirBecome('ENOTEMPTY: directory not empty');
    await expect(rmdirBecome('EACCES: permission denied')).rejects.toThrow(/EACCES/);
  });

  it('should unlink with become via rm -f argv', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: (file, args) => {
        calls.push({ file, args });
        return Effect.succeed('');
      },
    }));

    const target = join(testDir, 'file; rm -rf /');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.unlink(target, { become: true }));
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(MockExec),
    ));

    expect(calls).toEqual([{ file: 'rm', args: ['-f', '--', resolve(target)] }]);
    expect(calls.some((c) => c.args.includes('-rf'))).toBe(false);
  });

  it('should rm with become via rm -rf argv', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: (file, args) => {
        calls.push({ file, args });
        return Effect.succeed('');
      },
    }));

    const target = join(testDir, 'tree; rm -rf /');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.rm(target, { become: true }));
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(MockExec),
    ));

    expect(calls).toEqual([{ file: 'rm', args: ['-rf', '--', resolve(target)] }]);
  });

  it('should not recursively delete a directory on unlink', async () => {
    const dirPath = join(testDir, 'not-a-file');
    const keep = join(dirPath, 'keep.txt');
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.mkdir(dirPath));
      yield* _(fs.writeFile(keep, 'stay'));
      yield* _(fs.unlink(dirPath));
      const dirStays = yield* _(fs.exists(dirPath));
      const keepStays = yield* _(fs.exists(keep));
      return { dirStays, keepStays };
    });

    const stillThere = await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));

    expect(stillThere.dirStays).toBe(true);
    expect(stillThere.keepStays).toBe(true);

    await rm(testDir, { recursive: true, force: true });
  });

  it('should succeed unlinking a missing file', async () => {
    const program = Effect.gen(function* (_) {
      const fs = yield* _(FileSystem);
      yield* _(fs.unlink(join(testDir, 'gone.txt')));
    });

    await Effect.runPromise(program.pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));
  });

  it('should ignore ENOENT and EISDIR on become unlink', async () => {
    const MockExec = (message: string) => Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: () => Effect.fail(new Error(message)),
    }));

    const unlinkBecome = (message: string) => {
      const program = Effect.gen(function* (_) {
        const fs = yield* _(FileSystem);
        yield* _(fs.unlink(join(testDir, 'gone'), { become: true }));
      });
      return Effect.runPromise(program.pipe(
        Effect.provide(FileSystemLive),
        Effect.provide(MockExec(message)),
      ));
    };

    await unlinkBecome('ENOENT: no such file or directory');
    await unlinkBecome('EISDIR: Is a directory');
    await expect(unlinkBecome('EACCES: permission denied')).rejects.toThrow(/EACCES/);
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

import { describe, it, expect, vi } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { GitResource } from './git';
import { FileSystem } from '../services/fs';
import { SystemCommand } from '../services/exec';

describe('GitResource', () => {
  const MockFS = (exists: boolean = false) => Layer.succeed(FileSystem, FileSystem.of({
    exists: (path: string) => Effect.succeed(path.endsWith('.git') ? false : exists),
    rm: (path: string) => Effect.succeed(undefined),
    writeFileBytes: () => Effect.void,
  } as any));

  const MockExec = (commands: string[] = [], calls: { file: string; args: string[] }[] = []) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string, options?: any) => {
      commands.push(cmd);
      if (cmd === 'git remote get-url origin') return Effect.succeed('https://github.com/test/repo.git');
      return Effect.succeed('');
    },
    execFile: (file, args) => {
      calls.push({ file, args });
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (cmd === 'git remote get-url origin') return Effect.succeed('https://github.com/test/repo.git');
      return Effect.succeed('');
    },
  }));

  it('should clone a repository if it does not exist', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://github.com/test/repo.git',
      dest: '/tmp/repo'
    });

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(MockFS(false)),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands[0]).toBe('git clone https://github.com/test/repo.git /tmp/repo');
  });

  it('should clone with depth and branch', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://github.com/test/repo.git',
      dest: '/tmp/repo',
      depth: 1,
      branch: 'main'
    });

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(MockFS(false)),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands[0]).toBe('git clone --depth 1 --branch main https://github.com/test/repo.git /tmp/repo');
  });

  it('should handle sparse checkout', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://github.com/test/repo.git',
      dest: '/tmp/repo',
      sparse: ['dir1', 'dir2']
    });

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(MockFS(false)),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands).toContain('git clone --no-checkout https://github.com/test/repo.git /tmp/repo');
    expect(commands).toContain('git sparse-checkout init --cone');
    expect(commands).toContain('git sparse-checkout set dir1 dir2');
    expect(commands).toContain('git checkout HEAD');
  });

  it('should pull if repository already exists', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://github.com/test/repo.git',
      dest: '/tmp/repo'
    });

    // Mock FS to say .git exists
    const fsWithGit = Layer.succeed(FileSystem, FileSystem.of({
      exists: (path: string) => Effect.succeed(true),
      writeFileBytes: () => Effect.void,
    } as any));

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(fsWithGit),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands).toContain('git pull');
  });

  it('should pass a url with shell metacharacters as a single argv entry', async () => {
    const commands: string[] = [];
    const calls: { file: string; args: string[] }[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://example.com/x.git; id',
      dest: '/tmp/repo'
    });

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(MockFS(false)),
        Effect.provide(MockExec(commands, calls))
      )
    );

    expect(calls[0]).toEqual({
      file: 'git',
      args: ['clone', 'https://example.com/x.git; id', '/tmp/repo'],
    });
  });

  it('should spread sparse paths into argv instead of joining them', async () => {
    const commands: string[] = [];
    const calls: { file: string; args: string[] }[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const gitRes = new GitResource(stack, 'git-test', {
      url: 'https://github.com/test/repo.git',
      dest: '/tmp/repo',
      sparse: ['a', 'b']
    });

    await Effect.runPromise(
      gitRes.apply().pipe(
        Effect.provide(MockFS(false)),
        Effect.provide(MockExec(commands, calls))
      )
    );

    const setCall = calls.find((c) => c.args[0] === 'sparse-checkout' && c.args[1] === 'set');
    expect(setCall?.args).toEqual(['sparse-checkout', 'set', 'a', 'b']);
    expect(setCall?.args).not.toContain('a b');
  });
});

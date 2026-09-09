import { describe, it, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { SystemCommand, SystemCommandLive, buildSudoArgs } from './exec';

describe('SystemCommand Service', () => {
  it('should execute a shell command successfully', async () => {
    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      const output = yield* exec.run('echo "hello"');
      return output.trim();
    });

    const result = await Effect.runPromise(Effect.provide(program, SystemCommandLive));
    expect(result).toBe('hello');
  });

  it('should fail on invalid command', async () => {
    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      yield* exec.run('non-existent-command-123');
    });

    expect(Effect.runPromise(Effect.provide(program, SystemCommandLive))).rejects.toThrow();
  });

  it('should execute in a custom working directory', async () => {
    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      // In linux, pwd returns the current directory
      return yield* exec.run('pwd', { cwd: '/tmp' });
    });

    const result = await Effect.runPromise(Effect.provide(program, SystemCommandLive));
    expect(result).toBe('/tmp');
  });

  it('should execute with custom environment variables', async () => {
    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* exec.run('echo $TEST_VAR', { env: { TEST_VAR: 'hello-world' } });
    });

    const result = await Effect.runPromise(Effect.provide(program, SystemCommandLive));
    expect(result).toBe('hello-world');
  });

  it('should execFile echo hello', async () => {
    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* exec.execFile('echo', ['hello']);
    });

    const result = await Effect.runPromise(Effect.provide(program, SystemCommandLive));
    expect(result).toBe('hello');
  });

  it('should not interpret shell metacharacters in execFile args', async () => {
    const pwned = join(tmpdir(), `dotts-exec-pwned-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const payload = `a; touch ${pwned}`;

    const program = Effect.gen(function* () {
      const exec = yield* SystemCommand;
      return yield* exec.execFile('echo', [payload]);
    });

    const result = await Effect.runPromise(Effect.provide(program, SystemCommandLive));
    expect(result).toBe(payload);
    expect(existsSync(pwned)).toBe(false);
  });
});

describe('buildSudoArgs', () => {
  it('uses sudo without -u for become true and root', () => {
    expect([buildSudoArgs('echo', ['hi'], true).file, ...buildSudoArgs('echo', ['hi'], true).args]).toEqual([
      'sudo',
      'echo',
      'hi',
    ]);
    expect([buildSudoArgs('echo', ['hi'], 'root').file, ...buildSudoArgs('echo', ['hi'], 'root').args]).toEqual([
      'sudo',
      'echo',
      'hi',
    ]);
  });

  it('uses sudo -u for become username', () => {
    const result = buildSudoArgs('echo', ['hi'], 'www-data');
    expect([result.file, ...result.args]).toEqual(['sudo', '-u', 'www-data', 'echo', 'hi']);
  });

  it('leaves argv unchanged when become is falsy', () => {
    expect(buildSudoArgs('echo', ['hi'])).toEqual({ file: 'echo', args: ['hi'] });
  });
});

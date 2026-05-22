import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { SystemCommand, SystemCommandLive } from './exec';

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
});
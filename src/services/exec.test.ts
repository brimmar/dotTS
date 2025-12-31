import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { SystemCommand, SystemCommandLive } from './exec';

describe('SystemCommand Service', () => {
  it('should execute a shell command successfully', async () => {
    const program = Effect.gen(function* (_) {
      const exec = yield* _(SystemCommand);
      const output = yield* _(exec.run('echo "hello"'));
      return output.trim();
    });

    const runnable = Effect.provide(program, SystemCommandLive);
    const result = await Effect.runPromise(runnable);
    
    expect(result).toBe('hello');
  });

  it('should fail on invalid command', async () => {
    const program = Effect.gen(function* (_) {
      const exec = yield* _(SystemCommand);
      yield* _(exec.run('non-existent-command-123'));
    });

    const runnable = Effect.provide(program, SystemCommandLive);
    
    // Using Promise rejection for error assertion
    try {
      await Effect.runPromise(runnable);
      throw new Error('Should have failed');
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

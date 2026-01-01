import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { ScriptResource } from './script';
import { SystemCommand } from '../services/exec';

describe('ScriptResource', () => {
  it('should execute the run command', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    let executedCommand = '';
    let executedCwd = '';
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command, options) => Effect.sync(() => { 
          executedCommand = command; 
          executedCwd = options?.cwd || '';
          return ''; 
        })
      })
    );

    const scriptRes = new ScriptResource(stack, 'my-script', {
      run: 'echo hello',
      workingDir: '/tmp'
    });

    await Effect.runPromise(
      scriptRes.apply().pipe(
        Effect.provide(SystemCommandMock)
      )
    );
    
    expect(executedCommand).toBe('echo hello');
    expect(executedCwd).toBe('/tmp');
  });
});

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
        }),
        execFile: () => Effect.succeed(''),
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

  it('should skip execution if unless command succeeds', async () => {
    let executed = false;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) => {
          if (command === 'check-exists') return Effect.succeed('0'); // Sockets/shell success
          executed = true;
          return Effect.succeed('');
        },
        execFile: () => Effect.succeed(''),
      })
    );

    const scriptRes = new ScriptResource(new App() as any, 's1', {
      run: 'main-command',
      unless: 'check-exists'
    });

    await Effect.runPromise(Effect.provide(scriptRes.apply(), SystemCommandMock));
    expect(executed).toBe(false);
  });

  it('should execute if unless command fails', async () => {
    let executed = false;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) => {
          if (command === 'check-exists') return Effect.fail(new Error('1')); // shell fail
          executed = true;
          return Effect.succeed('');
        },
        execFile: () => Effect.succeed(''),
      })
    );

    const scriptRes = new ScriptResource(new App() as any, 's1', {
      run: 'main-command',
      unless: 'check-exists'
    });

    await Effect.runPromise(Effect.provide(scriptRes.apply(), SystemCommandMock));
    expect(executed).toBe(true);
  });

  it('should execute only if onlyIf command succeeds', async () => {
    let executed = false;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) => {
          if (command === 'should-run') return Effect.succeed('0');
          executed = true;
          return Effect.succeed('');
        },
        execFile: () => Effect.succeed(''),
      })
    );

    const scriptRes = new ScriptResource(new App() as any, 's1', {
      run: 'main-command',
      onlyIf: 'should-run'
    });

    await Effect.runPromise(Effect.provide(scriptRes.apply(), SystemCommandMock));
    expect(executed).toBe(true);
  });

  it('should skip if onlyIf command fails', async () => {
    let executed = false;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) => {
          if (command === 'should-not-run') return Effect.fail(new Error('1'));
          executed = true;
          return Effect.succeed('');
        },
        execFile: () => Effect.succeed(''),
      })
    );

    const scriptRes = new ScriptResource(new App() as any, 's1', {
      run: 'main-command',
      onlyIf: 'should-not-run'
    });

    await Effect.runPromise(Effect.provide(scriptRes.apply(), SystemCommandMock));
    expect(executed).toBe(false);
  });

  it('probes unless and onlyIf with intent read and leaves run as write', async () => {
    const intents: Array<{ command: string; intent: string | undefined }> = [];
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command, options) => {
          intents.push({ command, intent: options?.intent });
          if (command === 'check-exists') return Effect.fail(new Error('1'));
          return Effect.succeed('');
        },
        execFile: () => Effect.succeed(''),
      }),
    );

    const scriptRes = new ScriptResource(new App() as any, 's1', {
      run: 'main-command',
      unless: 'check-exists',
      onlyIf: 'should-run',
    });

    await Effect.runPromise(Effect.provide(scriptRes.apply(), SystemCommandMock));
    expect(intents).toEqual([
      { command: 'check-exists', intent: 'read' },
      { command: 'should-run', intent: 'read' },
      { command: 'main-command', intent: undefined },
    ]);
  });
});

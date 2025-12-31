import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { PackageResource } from './package';
import { SystemCommand } from '../services/exec';

describe('PackageResource', () => {
  it('should execute the correct install command', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    let executedCommand = '';
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (command) => Effect.sync(() => { 
          executedCommand = command; 
          return ''; 
        })
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
      manager: 'brew',
    });

    const program = pkgRes.apply();
    
    await Effect.runPromise(Effect.provide(program, SystemCommandMock));
    
    expect(executedCommand).toBe('brew install neovim');
  });
});

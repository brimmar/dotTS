import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { PackageResource } from './package';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';

describe('PackageResource', () => {
  const PlatformMock = Layer.succeed(
    PlatformService,
    PlatformService.of({
      get: () => Effect.succeed({ os: 'darwin', arch: 'arm64' })
    })
  );

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
    
    await Effect.runPromise(
      program.pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommand).toBe('brew install neovim');
  });

  it('should execute the correct uninstall command on destroy', async () => {
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

    const program = pkgRes.destroy();
    
    await Effect.runPromise(
      program.pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommand).toBe('brew uninstall neovim');
  });

  it('should infer the manager from the platform if not specified', async () => {
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
    });

    const program = pkgRes.apply();
    
    await Effect.runPromise(
      program.pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommand).toBe('brew install neovim');
  });
});

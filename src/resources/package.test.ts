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

  it('should execute install if not already installed', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    const executedCommands: [string, string[]][] = [];
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          executedCommands.push([file, args]);
          if (file === 'brew' && args[0] === 'list') return Effect.fail(new Error('Not found'));
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
      manager: 'brew',
    });

    await Effect.runPromise(
      pkgRes.apply().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommands).toContainEqual(['brew', ['install', 'neovim']]);
  });

  it('should execute the correct uninstall command on destroy', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    let executedCommand: [string, string[]] | undefined;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          executedCommand = [file, args];
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
      manager: 'brew',
    });

    await Effect.runPromise(
      pkgRes.destroy().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommand).toEqual(['brew', ['uninstall', 'neovim']]);
  });

  it('should infer the manager from the platform if not specified', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    const executedCommands: [string, string[]][] = [];
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          executedCommands.push([file, args]);
          if (file === 'brew' && args[0] === 'list') return Effect.fail(new Error('Not found'));
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
    });

    await Effect.runPromise(
      pkgRes.apply().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommands).toContainEqual(['brew', ['install', 'neovim']]);
  });

  it('should skip install if already installed on the system', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    const executedCommands: [string, string[]][] = [];
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          executedCommands.push([file, args]);
          if (file === 'brew' && args[0] === 'list') return Effect.succeed('neovim 0.9.0');
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
      manager: 'brew',
    });

    await Effect.runPromise(
      pkgRes.apply().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommands).not.toContainEqual(['brew', ['install', 'neovim']]);
  });

  it('should install a specific version if requested', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    const executedCommands: [string, string[]][] = [];
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => Effect.succeed(''),
        execFile: (file, args) => {
          executedCommands.push([file, args]);
          if (file === 'brew' && args[0] === 'list') return Effect.fail(new Error('Not found'));
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim',
      manager: 'brew',
      version: '0.9.0'
    });

    await Effect.runPromise(
      pkgRes.apply().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );
    
    expect(executedCommands).toContainEqual(['brew', ['install', 'neovim@0.9.0']]);
  });

  it('should pass a package name with shell metacharacters as a single argv entry', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');

    const executedCommands: [string, string[]][] = [];
    let runUsed = false;
    const SystemCommandMock = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: () => {
          runUsed = true;
          return Effect.succeed('');
        },
        execFile: (file, args) => {
          executedCommands.push([file, args]);
          if (file === 'brew' && args[0] === 'list') return Effect.fail(new Error('Not found'));
          return Effect.succeed('');
        },
      })
    );

    const pkgRes = new PackageResource(stack, 'my-pkg', {
      name: 'neovim; touch /tmp/pwned',
      manager: 'brew',
    });

    await Effect.runPromise(
      pkgRes.apply().pipe(
        Effect.provide(SystemCommandMock),
        Effect.provide(PlatformMock)
      )
    );

    const install = executedCommands.find(([file, args]) => file === 'brew' && args[0] === 'install');
    expect(install?.[1]).toEqual(['install', 'neovim; touch /tmp/pwned']);
    expect(runUsed).toBe(false);
  });
});

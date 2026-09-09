import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { ServiceResource } from './service';
import { SystemCommand } from '../services/exec';
import { PlatformService } from '../services/platform';

describe('ServiceResource', () => {
  const MockPlatform = Layer.succeed(PlatformService, PlatformService.of({
    get: () => Effect.succeed({ os: 'linux', distro: 'ubuntu' } as any)
  }));

  const record = (commands: string[], cmd: string) => {
    commands.push(cmd);
    if (cmd.includes('is-active')) return Effect.succeed('inactive');
    if (cmd.includes('is-enabled')) return Effect.succeed('disabled');
    return Effect.succeed('');
  };

  const MockExec = (commands: string[] = []) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
    execFile: (file, args) => {
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (args.includes('is-active') || args.includes('is-enabled')) {
        return Effect.fail(new Error(`Command failed: ${cmd}`));
      }
      if (args.includes('UnitFileState')) return Effect.succeed('disabled');
      if (args.includes('ActiveState')) return Effect.succeed('inactive');
      return Effect.succeed('');
    },
  }));

  it('should start and enable a service', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      state: 'started',
      enabled: true
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands).toContain('systemctl show -p UnitFileState --value nginx');
    expect(commands).toContain('systemctl enable nginx');
    expect(commands).toContain('systemctl show -p ActiveState --value nginx');
    expect(commands).toContain('systemctl start nginx');
  });

  it('should start and enable when is-enabled/is-active probes fail', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      state: 'started',
      enabled: true,
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockExec(commands)),
      ),
    );

    expect(commands.some((cmd) => cmd.includes('is-enabled') || cmd.includes('is-active'))).toBe(false);
    expect(commands).toContain('systemctl show -p UnitFileState --value nginx');
    expect(commands).toContain('systemctl enable nginx');
    expect(commands).toContain('systemctl show -p ActiveState --value nginx');
    expect(commands).toContain('systemctl start nginx');
  });

  it('should fail when systemctl is missing', async () => {
    const MockMissing = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
        execFile: (file, args) =>
          Effect.fail(new Error(`spawn ${file} ENOENT: ${args.join(' ')}`)),
      }),
    );

    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      state: 'started',
      enabled: true,
    });

    await expect(
      Effect.runPromise(
        res.apply().pipe(Effect.provide(MockPlatform), Effect.provide(MockMissing)),
      ),
    ).rejects.toThrow(/ENOENT/);
  });

  it('should restart a service', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      state: 'restarted'
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockExec(commands))
      )
    );

    expect(commands).toContain('systemctl show -p ActiveState --value nginx');
    expect(commands).toContain('systemctl restart nginx');
  });

  it('should treat a missing service as success on destroy', async () => {
    const commands: string[] = [];
    const MockMissing = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.succeed(''),
      execFile: (file, args) => {
        const cmd = [file, ...args].join(' ');
        commands.push(cmd);
        if (cmd.includes('stop')) return Effect.fail(new Error('Failed to stop nginx.service: Unit nginx.service not loaded.'));
        if (cmd.includes('disable')) return Effect.fail(new Error('Failed to disable unit: Unit file nginx.service does not exist.'));
        return Effect.succeed('');
      },
    }));
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', { name: 'nginx' });

    await Effect.runPromise(res.destroy().pipe(Effect.provide(MockMissing)));
    expect(commands).toContain('systemctl stop nginx');
    expect(commands).toContain('systemctl disable nginx');
  });

  it('should not treat an error that merely mentions inactive as absence', async () => {
    const MockInactive = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.succeed(''),
      execFile: (_file, args) => {
        if (args[0] === 'stop') {
          return Effect.fail(new Error('Failed to stop nginx.service: D-Bus connection inactive'));
        }
        return Effect.succeed('');
      },
    }));
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', { name: 'nginx' });

    await expect(Effect.runPromise(res.destroy().pipe(Effect.provide(MockInactive)))).rejects.toThrow(/connection inactive/);
  });
});

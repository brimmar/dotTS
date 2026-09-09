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

  const MockExec = (
    commands: string[] = [],
    calls: { file: string; args: string[]; intent?: 'read' | 'write' }[] = [],
  ) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
    execFile: (file, args, opts) => {
      calls.push({ file, args, intent: opts?.intent });
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
    const calls: { file: string; args: string[]; intent?: 'read' | 'write' }[] = [];
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
        Effect.provide(MockExec(commands, calls))
      )
    );

    expect(commands).toContain('systemctl show -p UnitFileState --value nginx');
    expect(commands).toContain('systemctl enable nginx');
    expect(commands).toContain('systemctl show -p ActiveState --value nginx');
    expect(commands).toContain('systemctl start nginx');
    expect(calls.find((c) => c.args.includes('UnitFileState'))?.intent).toBe('read');
    expect(calls.find((c) => c.args.includes('ActiveState'))?.intent).toBe('read');
    expect(calls.find((c) => c.args.includes('enable'))?.intent).toBeUndefined();
    expect(calls.find((c) => c.args.includes('start'))?.intent).toBeUndefined();
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
});

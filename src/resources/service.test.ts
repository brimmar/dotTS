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

  const MockExec = (commands: string[] = []) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
    execFile: (file, args) => {
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (args[0] === 'is-enabled') {
        return Effect.fail(new Error('Command failed: systemctl is-enabled nginx\nError: exit 1\ndisabled'));
      }
      if (args[0] === 'is-active') {
        return Effect.fail(new Error('Command failed: systemctl is-active nginx\nError: exit 3\ninactive'));
      }
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

    expect(commands).toContain('systemctl is-enabled nginx');
    expect(commands).toContain('systemctl enable nginx');
    expect(commands).toContain('systemctl is-active nginx');
    expect(commands).toContain('systemctl start nginx');
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

    expect(commands).toContain('systemctl restart nginx');
  });

  it('still enable/start when is-enabled exits 1 disabled and is-active exits 3', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'sshd',
      state: 'started',
      enabled: true,
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockExec(commands)),
      ),
    );

    expect(commands).toContain('systemctl is-enabled sshd');
    expect(commands).toContain('systemctl enable sshd');
    expect(commands).toContain('systemctl is-active sshd');
    expect(commands).toContain('systemctl start sshd');
  });

  it('fails when systemctl is missing', async () => {
    const MockMissing = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
        execFile: (file, args) =>
          Effect.fail(new Error(`Command failed: ${file} ${args.join(' ')}\nError: spawn ${file} ENOENT`)),
      }),
    );

    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      enabled: true,
    });

    await expect(
      Effect.runPromise(
        res.apply().pipe(
          Effect.provide(MockPlatform),
          Effect.provide(MockMissing),
        ),
      ),
    ).rejects.toThrow(/ENOENT/);
  });

  it('probes is-enabled/is-active with intent read and leaves enable/start as write', async () => {
    const calls: { file: string; args: string[]; intent?: 'read' | 'write' }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
        execFile: (file, args, options) => {
          calls.push({ file, args, intent: options?.intent });
          if (args[0] === 'is-enabled') {
            return Effect.fail(new Error('Command failed: systemctl is-enabled nginx\nError: exit 1\ndisabled'));
          }
          if (args[0] === 'is-active') {
            return Effect.fail(new Error('Command failed: systemctl is-active nginx\nError: exit 3\ninactive'));
          }
          return Effect.succeed('');
        },
      }),
    );

    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new ServiceResource(stack, 'test-service', {
      name: 'nginx',
      state: 'started',
      enabled: true,
    });

    await Effect.runPromise(
      res.apply().pipe(Effect.provide(MockPlatform), Effect.provide(MockExec)),
    );

    const probes = calls.filter((c) => c.args[0] === 'is-enabled' || c.args[0] === 'is-active');
    expect(probes).toHaveLength(2);
    expect(probes.every((c) => c.intent === 'read')).toBe(true);

    const writes = calls.filter((c) => c.args[0] === 'enable' || c.args[0] === 'start');
    expect(writes.map((c) => c.args[0]).sort()).toEqual(['enable', 'start']);
    expect(writes.every((c) => c.intent === undefined)).toBe(true);
  });
});

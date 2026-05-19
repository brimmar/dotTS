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
    run: (cmd: string) => {
      commands.push(cmd);
      if (cmd.includes('is-active')) return Effect.succeed('inactive');
      if (cmd.includes('is-enabled')) return Effect.succeed('disabled');
      return Effect.succeed('');
    }
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
});

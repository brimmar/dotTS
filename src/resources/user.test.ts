import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { UserResource } from './user';
import { SystemCommand } from '../services/exec';

describe('UserResource', () => {
  const MockExec = (commands: string[] = [], exists: boolean = false, calls: { file: string; args: string[] }[] = []) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
    execFile: (file, args) => {
      calls.push({ file, args });
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (file === 'id' && args.length === 1) {
        return exists ? Effect.succeed('uid=1000(testuser)...') : Effect.fail(new Error('not found'));
      }
      return Effect.succeed('');
    },
  }));

  it('should create a user if it does not exist', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', {
      name: 'testuser',
      shell: '/bin/bash',
      groups: ['sudo', 'docker']
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockExec(commands, false))
      )
    );

    expect(commands).toContain('useradd --groups sudo,docker --shell /bin/bash --create-home testuser');
  });

  it('should delete a user if state is absent', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', {
      name: 'testuser',
      state: 'absent'
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockExec(commands, true))
      )
    );

    expect(commands).toContain('userdel --remove testuser');
  });

  it('should pass a user name with semicolon as a single argv entry', async () => {
    const commands: string[] = [];
    const calls: { file: string; args: string[] }[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', {
      name: 'alice; id'
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockExec(commands, false, calls))
      )
    );

    const useradd = calls.find((c) => c.file === 'useradd');
    expect(useradd).toBeDefined();
    expect(useradd?.args.at(-1)).toBe('alice; id');
    expect(useradd?.args).toContain('alice; id');
  });

  it('probes id/getent with intent read and leaves usermod as write', async () => {
    const calls: { file: string; args: string[]; intent?: 'read' | 'write' }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
        execFile: (file, args, options) => {
          calls.push({ file, args, intent: options?.intent });
          if (file === 'id' && args.length === 1) return Effect.succeed('uid=1000(testuser)...');
          if (file === 'id' && args[0] === '-u') return Effect.succeed('1000');
          if (file === 'id' && args[0] === '-g') return Effect.succeed('1000');
          if (file === 'id' && args[0] === '-Gn') return Effect.succeed('testuser');
          if (file === 'getent' && args[0] === 'passwd') {
            return Effect.succeed('testuser:x:1000:1000::/home/testuser:/bin/sh');
          }
          return Effect.succeed('');
        },
      }),
    );

    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', {
      name: 'testuser',
      uid: 2000,
      gid: 2000,
      groups: ['sudo'],
      shell: '/bin/bash',
    });

    await Effect.runPromise(res.apply().pipe(Effect.provide(MockExec)));

    const probes = calls.filter((c) => c.file === 'id' || c.file === 'getent');
    expect(probes.length).toBeGreaterThan(0);
    expect(probes.every((c) => c.intent === 'read')).toBe(true);

    const usermod = calls.find((c) => c.file === 'usermod');
    expect(usermod).toBeDefined();
    expect(usermod?.intent).toBeUndefined();
  });
});

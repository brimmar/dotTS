import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { GroupResource } from './group';
import { SystemCommand } from '../services/exec';

describe('GroupResource', () => {
  const MockExec = (commands: string[] = [], exists: boolean = false) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
    execFile: (file, args) => {
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (file === 'getent' && args[0] === 'group') {
        return exists ? Effect.succeed('group:x:1000:') : Effect.fail(new Error('not found'));
      }
      return Effect.succeed('');
    },
  }));

  it('should create a group if it does not exist', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new GroupResource(stack, 'test-group', {
      name: 'developers',
      gid: 1000
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockExec(commands, false))
      )
    );

    expect(commands).toContain('groupadd --gid 1000 developers');
  });

  it('should delete a group if state is absent', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new GroupResource(stack, 'test-group', {
      name: 'developers',
      state: 'absent'
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockExec(commands, true))
      )
    );

    expect(commands).toContain('groupdel developers');
  });

  it('probes getent with intent read and leaves groupmod as write', async () => {
    const calls: { file: string; args: string[]; intent?: 'read' | 'write' }[] = [];
    const MockExec = Layer.succeed(
      SystemCommand,
      SystemCommand.of({
        run: (cmd: string) => Effect.fail(new Error(`unexpected run: ${cmd}`)),
        execFile: (file, args, options) => {
          calls.push({ file, args, intent: options?.intent });
          if (file === 'getent' && args[0] === 'group') return Effect.succeed('developers:x:1000:');
          return Effect.succeed('');
        },
      }),
    );

    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new GroupResource(stack, 'test-group', {
      name: 'developers',
      gid: 2000,
    });

    await Effect.runPromise(res.apply().pipe(Effect.provide(MockExec)));

    const getent = calls.filter((c) => c.file === 'getent');
    expect(getent.length).toBeGreaterThan(0);
    expect(getent.every((c) => c.intent === 'read')).toBe(true);

    const groupmod = calls.find((c) => c.file === 'groupmod');
    expect(groupmod).toBeDefined();
    expect(groupmod?.intent).toBeUndefined();
  });
});

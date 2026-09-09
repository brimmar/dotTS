import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { GroupResource } from './group';
import { SystemCommand } from '../services/exec';

describe('GroupResource', () => {
  const MockExec = (commands: string[] = [], exists: boolean = false) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => {
      commands.push(cmd);
      if (cmd.startsWith('getent group')) {
        return exists ? Effect.succeed('group:x:1000:') : Effect.fail(new Error('not found'));
      }
      return Effect.succeed('');
    },
    execFile: (file, args) => {
      const cmd = [file, ...args].join(' ');
      commands.push(cmd);
      if (cmd.startsWith('getent group')) {
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
});

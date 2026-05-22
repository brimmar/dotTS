import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { UserResource } from './user';
import { SystemCommand } from '../services/exec';

describe('UserResource', () => {
  const MockExec = (commands: string[] = [], exists: boolean = false) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => {
      commands.push(cmd);
      if (cmd.startsWith('id ')) {
        return exists ? Effect.succeed('uid=1000(testuser)...') : Effect.fail(new Error('not found'));
      }
      return Effect.succeed('');
    }
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
});

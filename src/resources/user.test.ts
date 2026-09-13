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

    expect(commands).toContain('userdel testuser');
    expect(commands.some((c) => c.includes('--remove'))).toBe(false);
  });

  it('should not remove home on destroy unless removeHome is set', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', { name: 'testuser' });

    await Effect.runPromise(
      res.destroy().pipe(
        Effect.provide(MockExec(commands, true))
      )
    );

    expect(commands).toContain('userdel testuser');
    expect(commands.some((c) => c.includes('--remove'))).toBe(false);
  });

  it('should pass --remove on destroy when removeHome is set', async () => {
    const commands: string[] = [];
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', { name: 'testuser', removeHome: true });

    await Effect.runPromise(
      res.destroy().pipe(
        Effect.provide(MockExec(commands, true))
      )
    );

    expect(commands).toContain('userdel --remove testuser');
  });

  it('should treat a missing user as success on destroy', async () => {
    const commands: string[] = [];
    const MockMissing = Layer.succeed(SystemCommand, SystemCommand.of({
      run: (cmd: string) => {
        commands.push(cmd);
        return Effect.fail(new Error("userdel: user 'testuser' does not exist"));
      },
      execFile: (file, args) => {
        commands.push([file, ...args].join(' '));
        return Effect.fail(new Error("userdel: user 'testuser' does not exist"));
      },
    }));
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new UserResource(stack, 'test-user', { name: 'testuser' });

    await Effect.runPromise(res.destroy().pipe(Effect.provide(MockMissing)));
    expect(commands).toContain('userdel testuser');
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
});

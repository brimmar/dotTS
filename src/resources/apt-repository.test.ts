import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { AptRepositoryResource } from './apt-repository';
import { SystemCommand } from '../services/exec';
import { FileSystem } from '../services/fs';
import { HttpService } from '../services/http';
import { PlatformService } from '../services/platform';

describe('AptRepositoryResource', () => {
  const MockPlatform = Layer.succeed(PlatformService, PlatformService.of({
    get: () => Effect.succeed({ os: 'linux', distro: 'ubuntu' } as any)
  }));

  const MockFS = (files: Record<string, string> = {}) => Layer.succeed(FileSystem, FileSystem.of({
    exists: (path: string) => Effect.succeed(files[path] !== undefined),
    readFile: (path: string) => Effect.succeed(files[path] || ''),
    writeFile: (path: string, content: string) => Effect.sync(() => { files[path] = content; }),
    mkdir: (path: string) => Effect.succeed(undefined),
    rm: (path: string) => Effect.sync(() => { delete files[path]; }),
    writeFileBytes: () => Effect.void,
  } as any));

  const MockHttp = (keyContent: string) => Layer.succeed(HttpService, HttpService.of({
    downloadString: (url: string) => Effect.succeed(keyContent),
    downloadBytes: (url: string) => Effect.succeed(new TextEncoder().encode(keyContent)),
  } as any));

  const MockExec = (commands: string[] = []) => Layer.succeed(SystemCommand, SystemCommand.of({
    run: (cmd: string) => {
      commands.push(cmd);
      return Effect.succeed('');
    },
    execFile: (file, args) => {
      commands.push([file, ...args].join(' '));
      return Effect.succeed('');
    },
  }));

  it('should add a repository and download key', async () => {
    const commands: string[] = [];
    const files: Record<string, string> = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new AptRepositoryResource(stack, 'test-repo', {
      name: 'docker',
      uri: 'https://download.docker.com/linux/ubuntu',
      distribution: 'focal',
      components: ['stable'],
      key: 'https://download.docker.com/linux/ubuntu/gpg'
    });

    const keyContent = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n...';

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockFS(files)),
        Effect.provide(MockHttp(keyContent)),
        Effect.provide(MockExec(commands))
      )
    );

    expect(files['/etc/apt/sources.list.d/docker.list']).toContain('[signed-by=/etc/apt/keyrings/docker.gpg]');
    expect(commands).toContain('gpg --dearmor --output /etc/apt/keyrings/docker.gpg /tmp/dotts-docker.key');
    expect(commands).toContain('apt-get update');
  });

  it('should remove a repository when state is absent', async () => {
    const commands: string[] = [];
    const files: Record<string, string> = {
      '/etc/apt/sources.list.d/docker.list': '...',
      '/etc/apt/keyrings/docker.gpg': '...'
    };
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new AptRepositoryResource(stack, 'test-repo', {
      name: 'docker',
      uri: 'https://download.docker.com/linux/ubuntu',
      distribution: 'focal',
      components: ['stable'],
      state: 'absent'
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockFS(files)),
        Effect.provide(MockHttp('')),
        Effect.provide(MockExec(commands))
      )
    );

    expect(files['/etc/apt/sources.list.d/docker.list']).toBeUndefined();
    expect(files['/etc/apt/keyrings/docker.gpg']).toBeUndefined();
    expect(commands).toContain('apt-get update');
  });

  it('allows aptRepository on Pop!_OS', async () => {
    const PopPlatform = Layer.succeed(
      PlatformService,
      PlatformService.of({
        get: () =>
          Effect.succeed({
            os: 'linux',
            distro: 'pop',
            distroLike: ['ubuntu', 'debian'],
          } as any),
      }),
    );
    const commands: string[] = [];
    const files: Record<string, string> = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new AptRepositoryResource(stack, 'test-repo', {
      name: 'docker',
      uri: 'https://download.docker.com/linux/ubuntu',
      distribution: 'jammy',
      components: ['stable'],
    });

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(PopPlatform),
        Effect.provide(MockFS(files)),
        Effect.provide(MockHttp('')),
        Effect.provide(MockExec(commands)),
      ),
    );

    expect(files['/etc/apt/sources.list.d/docker.list']).toContain('jammy');
  });

  it('should have concurrencyKey as pkg-manager-system', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new AptRepositoryResource(stack, 'test-repo', {
      name: 'docker',
      uri: 'https://download.docker.com/linux/ubuntu',
      distribution: 'jammy',
      components: ['stable'],
    });

    expect(res.concurrencyKey).toBe('pkg-manager-system');
  });

  it('should copy binary OpenPGP keys directly without gpg dearmor', async () => {
    const commands: string[] = [];
    const files: Record<string, string> = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new AptRepositoryResource(stack, 'test-repo', {
      name: 'github-cli',
      uri: 'https://cli.github.com/packages',
      distribution: 'stable',
      components: ['main'],
      key: 'https://cli.github.com/packages/githubcli-archive-keyring.gpg',
    });

    // Binary data (starts with OpenPGP packet tag, not ASCII armor)
    const binaryKey = String.fromCharCode(0x99, 0x01, 0x00);

    await Effect.runPromise(
      res.apply().pipe(
        Effect.provide(MockPlatform),
        Effect.provide(MockFS(files)),
        Effect.provide(MockHttp(binaryKey)),
        Effect.provide(MockExec(commands)),
      ),
    );

    expect(commands).toContain('cp /tmp/dotts-github-cli.key /etc/apt/keyrings/github-cli.gpg');
    expect(commands.some((c) => c.includes('gpg --dearmor'))).toBe(false);
  });
});

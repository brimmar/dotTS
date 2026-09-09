import { describe, it, expect, beforeEach } from 'bun:test';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Effect, Layer } from 'effect';
import { RemoteFileResource } from './remote-file';
import { HttpService } from '../services/http';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { App, Stack } from '../core/app';

describe('RemoteFileResource', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'test');
  });

  it('should download a remote file', async () => {
    let downloadedUrl = '';
    let writtenPath = '';
    let writtenContent = '';

    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: (url) => Effect.sync(() => { downloadedUrl = url; return 'remote content'; }),
      downloadBytes: (url) => Effect.sync(() => { downloadedUrl = url; return new Uint8Array(); }),
      downloadWithMetadata: (url) => Effect.sync(() => ({ content: 'remote content', unchanged: false }))
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: (path, content) => Effect.sync(() => { writtenPath = path; writtenContent = content; }),
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
      rmdir: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
    }));

    const res = new RemoteFileResource(stack, 'remote-1', {
      url: 'https://example.com/file.txt',
      path: '/tmp/file.txt',
    });

    await Effect.runPromise(res.apply().pipe(
      Effect.provide(Layer.mergeAll(MockHttp, MockFS))
    ));

    expect(downloadedUrl).toBe('https://example.com/file.txt');
    expect(writtenPath).toBe('/tmp/file.txt');
    expect(writtenContent).toBe('remote content');
  });

  it('should fail if sha256 hash mismatch', async () => {
    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: () => Effect.succeed('wrong content'),
      downloadBytes: () => Effect.succeed(new Uint8Array()),
      downloadWithMetadata: () => Effect.succeed({ content: 'content', unchanged: false })
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
      rmdir: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
    }));

    const res = new RemoteFileResource(stack, 'remote-fail', {
      url: 'https://example.com/file.txt',
      path: '/tmp/file.txt',
      sha256: 'ed7002b439e9ac845f22357d822baa1444730df89de548322927c6f1208a0ef9', // sha256 of 'remote content'
    });

    const result = await Effect.runPromiseExit(res.apply().pipe(
      Effect.provide(Layer.mergeAll(MockHttp, MockFS))
    ));

    expect(result._tag).toBe('Failure');
  });

  it('should apply POSIX attributes', async () => {
    let chmodPath = '';
    let chmodMode = 0;
    let chownPath = '';
    let chownUid = 0;
    let chownGid = 0;

    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: () => Effect.succeed('content'),
      downloadBytes: () => Effect.succeed(new Uint8Array()),
      downloadWithMetadata: () => Effect.succeed({ content: 'content', unchanged: false })
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
      rmdir: () => Effect.void,
      unlink: () => Effect.void,
      chmod: (path, mode) => Effect.sync(() => { chmodPath = path; chmodMode = mode; }),
      chown: (path, uid, gid) => Effect.sync(() => { chownPath = path; chownUid = uid; chownGid = gid; }),
    }));

    const res = new RemoteFileResource(stack, 'remote-attrs', {
      url: 'https://example.com/file.txt',
      path: '/tmp/file.txt',
      mode: 0o644,
      uid: 1000,
      gid: 1000,
    });

    await Effect.runPromise(res.apply().pipe(
      Effect.provide(Layer.mergeAll(MockHttp, MockFS))
    ));

    expect(chmodPath).toBe('/tmp/file.txt');
    expect(chmodMode).toBe(0o644);
    expect(chownPath).toBe('/tmp/file.txt');
    expect(chownUid).toBe(1000);
    expect(chownGid).toBe(1000);
  });

  it('should unlink the file on destroy, never rm', async () => {
    const state: { unlink?: string; rm?: string } = {};
    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(true),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: (path) => Effect.sync(() => { state.rm = path; }),
      rmdir: () => Effect.void,
      unlink: (path) => Effect.sync(() => { state.unlink = path; }),
      chmod: () => Effect.void,
      chown: () => Effect.void,
    }));

    const res = new RemoteFileResource(stack, 'remote-destroy', {
      url: 'https://example.com/file.txt',
      path: '/tmp/file.txt',
    });

    await Effect.runPromise(res.destroy().pipe(Effect.provide(MockFS)));

    expect(state.unlink).toBe('/tmp/file.txt');
    expect(state.rm).toBeUndefined();
  });

  it('should destroy with become via rm -f argv, never rm -rf', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.fail(new Error('run should not be used')),
      execFile: (file, args) => {
        calls.push({ file, args });
        return Effect.succeed('');
      },
    }));

    const path = '/tmp/remote; rm -rf /';
    const res = new RemoteFileResource(stack, 'remote-become', {
      url: 'https://example.com/file.txt',
      path,
      become: true,
    });

    await Effect.runPromise(res.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(MockExec),
    ));

    expect(calls).toEqual([{ file: 'rm', args: ['-f', '--', resolve(path)] }]);
    expect(calls.some((c) => c.args.includes('-rf'))).toBe(false);
  });

  it('should not recursively delete a directory on destroy', async () => {
    const testDir = join(tmpdir(), 'dotts-remote-dir-destroy-' + Math.random().toString(36).slice(2));
    const dirPath = join(testDir, 'was-a-file');
    await mkdir(dirPath, { recursive: true });
    const keep = join(dirPath, 'keep.txt');
    await writeFile(keep, 'stay');

    const res = new RemoteFileResource(stack, 'remote-dir', {
      url: 'https://example.com/file.txt',
      path: dirPath,
    });

    await Effect.runPromise(res.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));

    expect(existsSync(keep)).toBe(true);
    await rm(testDir, { recursive: true, force: true });
  });

  it('should succeed destroy when the file is already gone', async () => {
    const testDir = join(tmpdir(), 'dotts-remote-missing-destroy-' + Math.random().toString(36).slice(2));
    await mkdir(testDir, { recursive: true });
    const path = join(testDir, 'gone.txt');

    const res = new RemoteFileResource(stack, 'remote-gone', {
      url: 'https://example.com/file.txt',
      path,
    });

    await Effect.runPromise(res.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));

    expect(existsSync(path)).toBe(false);
    await rm(testDir, { recursive: true, force: true });
  });
});

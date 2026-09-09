import { describe, it, expect, beforeEach } from 'bun:test';
import { Effect, Layer } from 'effect';
import { RemoteFileResource } from './remote-file';
import { HttpService } from '../services/http';
import { FileSystem } from '../services/fs';
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
    let writtenContent: Uint8Array | undefined;
    const bytes = new Uint8Array([0, 1, 2, 255]);

    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: (url) => Effect.sync(() => { downloadedUrl = url; return 'remote content'; }),
      downloadBytes: (url) => Effect.sync(() => { downloadedUrl = url; return bytes; }),
      downloadWithMetadata: (url) => Effect.sync(() => ({ content: 'remote content', unchanged: false }))
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
      writeFileBytes: (path, content) => Effect.sync(() => { writtenPath = path; writtenContent = content; }),
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
    expect(writtenContent).toEqual(bytes);
  });

  it('should fail if sha256 hash mismatch', async () => {
    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: () => Effect.succeed('wrong content'),
      downloadBytes: () => Effect.succeed(new Uint8Array([1, 2, 3])),
      downloadWithMetadata: () => Effect.succeed({ content: 'content', unchanged: false })
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: () => Effect.void,
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
      unlink: () => Effect.void,
      chmod: () => Effect.void,
      chown: () => Effect.void,
      writeFileBytes: () => Effect.void,
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
      unlink: () => Effect.void,
      chmod: (path, mode) => Effect.sync(() => { chmodPath = path; chmodMode = mode; }),
      chown: (path, uid, gid) => Effect.sync(() => { chownPath = path; chownUid = uid; chownGid = gid; }),
      writeFileBytes: () => Effect.void,
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
});

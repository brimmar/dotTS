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
    let writtenContent = '';

    const MockHttp = Layer.succeed(HttpService, HttpService.of({
      downloadString: (url) => Effect.sync(() => { downloadedUrl = url; return 'remote content'; }),
      downloadBytes: (url) => Effect.sync(() => { downloadedUrl = url; return new Uint8Array(); }),
    }));

    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      writeFile: (path, content) => Effect.sync(() => { writtenPath = path; writtenContent = content; }),
      readFile: () => Effect.succeed(''),
      exists: () => Effect.succeed(false),
      mkdir: () => Effect.void,
      symlink: () => Effect.void,
      rm: () => Effect.void,
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
});

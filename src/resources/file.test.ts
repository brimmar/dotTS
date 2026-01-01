import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { FileResource } from './file';
import { FileSystem } from '../services/fs';
import { SecretManager } from '../services/secrets-manager';
import { TemplateService, TemplateServiceLive } from '../services/template';

describe('FileResource', () => {
  const MockFS = (state: any) => Layer.succeed(FileSystem, FileSystem.of({
    writeFile: (path, content) => Effect.sync(() => { state.writtenPath = path; state.writtenContent = content; state.exists = true; }),
    readFile: () => Effect.succeed(''),
    exists: () => Effect.sync(() => state.exists),
    mkdir: () => Effect.void,
    symlink: () => Effect.void,
    rm: () => Effect.sync(() => { state.exists = false; }),
    unlink: () => Effect.sync(() => { state.exists = false; }),
    chmod: (path, mode) => Effect.sync(() => { state.chmod = { path, mode }; }),
    chown: (path, uid, gid) => Effect.sync(() => { state.chown = { path, uid, gid }; }),
  }));

  const MockSM = Layer.succeed(SecretManager, SecretManager.of({
    get: (name) => Effect.succeed('secret-val'),
    set: () => Effect.void,
    list: () => Effect.succeed([]),
    setPaths: () => Effect.void,
  }));

  const MockTemplate = Layer.succeed(TemplateService, TemplateService.of({
    render: (template, view) => Effect.succeed(template.replace('{{name}}', view.name)),
  }));

  it('should write file content', async () => {
    const state = { writtenPath: '', writtenContent: '', exists: false };
    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'my-file', { path: '/tmp/test.txt', content: 'hello' });

    await Effect.runPromise(
      Effect.provide(fileRes.apply(), Layer.mergeAll(MockFS(state), MockSM, MockTemplate))
    );
    
    expect(state.writtenPath).toBe('/tmp/test.txt');
    expect(state.writtenContent).toBe('hello');
  });

  it('should remove the file on destroy', async () => {
    const state = { exists: true };
    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'test-file', { path: '/tmp/test.txt', content: 'to be deleted' });

    const program = Effect.gen(function* () {
      const fs = yield* FileSystem;
      const existsBefore = yield* fs.exists('/tmp/test.txt');
      yield* fileRes.destroy();
      const existsAfter = yield* fs.exists('/tmp/test.txt');
      return { existsBefore, existsAfter };
    });

    const { existsBefore, existsAfter } = await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(MockFS(state), MockSM, MockTemplate))
    );

    expect(existsBefore).toBe(true);
    expect(existsAfter).toBe(false);
  });

  it('should apply file attributes (mode, owner, group)', async () => {
    const state: any = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'my-file', {
      path: '/tmp/attr-test.txt',
      content: 'hello',
      mode: 0o644,
      uid: 1000,
      gid: 1000,
    } as any);

    await Effect.runPromise(
      Effect.provide(fileRes.apply(), Layer.mergeAll(MockFS(state), MockSM, MockTemplate))
    );
    
    expect(state.chmod).toEqual({ path: '/tmp/attr-test.txt', mode: 0o644 });
    expect(state.chown).toEqual({ path: '/tmp/attr-test.txt', uid: 1000, gid: 1000 });
  });

  it('should render content as a template if vars are provided', async () => {
    const state: any = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'tpl-file', {
      path: '/tmp/tpl.txt',
      content: 'Hello {{name}}!',
      vars: { name: 'Dotts' }
    } as any);

    await Effect.runPromise(
      Effect.provide(fileRes.apply(), Layer.mergeAll(MockFS(state), MockSM, MockTemplate))
    );
    
    expect(state.writtenContent).toBe('Hello Dotts!');
  });
});
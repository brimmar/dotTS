import { describe, it, expect } from 'bun:test';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { FileResource } from './file';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { SecretManager } from '../services/secrets-manager';
import { TemplateService, TemplateServiceLive } from '../services/template';

describe('FileResource', () => {
  const MockFS = (state: any) => Layer.succeed(FileSystem, FileSystem.of({
    writeFile: (path, content) => Effect.sync(() => { state.writtenPath = path; state.writtenContent = content; state.exists = true; }),
    readFile: () => Effect.succeed(''),
    exists: () => Effect.sync(() => state.exists),
    mkdir: () => Effect.void,
    symlink: () => Effect.void,
    rm: (path) => Effect.sync(() => { state.rm = path; state.exists = false; }),
    rmdir: () => Effect.void,
    unlink: (path) => Effect.sync(() => { state.unlink = path; state.exists = false; }),
    chmod: (path, mode) => Effect.sync(() => { state.chmod = { path, mode }; }),
    chown: (path, uid, gid) => Effect.sync(() => { state.chown = { path, uid, gid }; }),
  }));

  const MockSM = Layer.succeed(SecretManager, SecretManager.of({
    get: (name) => Effect.succeed('secret-val'),
    set: () => Effect.void,
    list: () => Effect.succeed([]),
    setPaths: () => Effect.void,
    remove: () => Effect.void,
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
    const state: { exists: boolean; unlink?: string; rm?: string } = { exists: true };
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
    expect(state.unlink).toBe('/tmp/test.txt');
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

    const path = '/tmp/file; rm -rf /';
    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'test-file', {
      path,
      content: 'to be deleted',
      become: true,
    });

    await Effect.runPromise(fileRes.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(MockExec),
    ));

    expect(calls).toEqual([{ file: 'rm', args: ['-f', '--', resolve(path)] }]);
    expect(calls.some((c) => c.args.includes('-rf'))).toBe(false);
  });

  it('should not recursively delete a directory on destroy', async () => {
    const testDir = join(tmpdir(), 'dotts-file-dir-destroy-' + Math.random().toString(36).slice(2));
    const dirPath = join(testDir, 'was-a-file');
    await mkdir(dirPath, { recursive: true });
    const keep = join(dirPath, 'keep.txt');
    await writeFile(keep, 'stay');

    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'test-file', { path: dirPath, content: 'x' });

    await Effect.runPromise(fileRes.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));

    expect(existsSync(keep)).toBe(true);
    await rm(testDir, { recursive: true, force: true });
  });

  it('should succeed destroy when the file is already gone', async () => {
    const testDir = join(tmpdir(), 'dotts-file-missing-destroy-' + Math.random().toString(36).slice(2));
    await mkdir(testDir, { recursive: true });
    const path = join(testDir, 'gone.txt');

    const app = new App();
    const stack = new Stack(app, 'test');
    const fileRes = new FileResource(stack, 'test-file', { path, content: 'x' });

    await Effect.runPromise(fileRes.destroy().pipe(
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive),
    ));

    expect(existsSync(path)).toBe(false);
    await rm(testDir, { recursive: true, force: true });
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
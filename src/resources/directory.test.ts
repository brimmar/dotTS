import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { DirectoryResource } from './directory';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommandLive } from '../services/exec';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

describe('DirectoryResource', () => {
  const testDir = join(tmpdir(), 'dotts-dir-res-test-' + Math.random().toString(36).slice(2));

  const MockFS = (state: any) => Layer.succeed(FileSystem, FileSystem.of({
    mkdir: (path: string) => Effect.sync(() => { state.createdDir = path; state.exists = true; }),
    exists: (path: string) => Effect.sync(() => state.exists),
    rm: (path: string) => Effect.sync(() => { state.rm = path; state.exists = false; }),
    rmdir: (path: string) => Effect.sync(() => { state.rmdir = path; state.exists = false; }),
    chmod: (path: string, mode: number) => Effect.sync(() => { state.chmod = { path, mode }; }),
    chown: (path: string, uid: number, gid: number) => Effect.sync(() => { state.chown = { path, uid, gid }; }),
  } as any));

  it('should create a directory', async () => {
    const state: any = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const dirRes = new DirectoryResource(stack, 'my-dir', { path: '/tmp/test-dir' });

    await Effect.runPromise(Effect.provide(dirRes.apply(), MockFS(state)));
    
    expect(state.createdDir).toBe('/tmp/test-dir');
  });

  it('should apply mode and owner', async () => {
    const state: any = {};
    const app = new App();
    const stack = new Stack(app, 'test');
    const dirRes = new DirectoryResource(stack, 'my-dir', {
      path: '/tmp/test-dir',
      mode: 0o700,
      uid: 1000,
      gid: 1000,
    });

    await Effect.runPromise(Effect.provide(dirRes.apply(), MockFS(state)));
    
    expect(state.chmod).toEqual({ path: '/tmp/test-dir', mode: 0o700 });
    expect(state.chown).toEqual({ path: '/tmp/test-dir', uid: 1000, gid: 1000 });
  });

  it('should rmdir an empty directory on destroy', async () => {
    const state: any = { exists: true };
    const app = new App();
    const stack = new Stack(app, 'test');
    const dirRes = new DirectoryResource(stack, 'my-dir', { path: '/tmp/test-dir' });

    await Effect.runPromise(Effect.provide(dirRes.destroy(), MockFS(state)));
    
    expect(state.rmdir).toBe('/tmp/test-dir');
    expect(state.rm).toBeUndefined();
    expect(state.exists).toBe(false);
  });

  it('should leave unmanaged files in a non-empty directory', async () => {
    const dirPath = join(testDir, 'nonempty');
    await mkdir(dirPath, { recursive: true });
    const keep = join(dirPath, 'keep.txt');
    await writeFile(keep, 'stay');

    const app = new App();
    const stack = new Stack(app, 'test');
    const dirRes = new DirectoryResource(stack, 'my-dir', { path: dirPath });

    await Effect.runPromise(
      Effect.provide(
        dirRes.destroy(),
        FileSystemLive.pipe(Layer.provide(SystemCommandLive)),
      ),
    );

    expect(existsSync(keep)).toBe(true);
    await rm(testDir, { recursive: true, force: true });
  });
});

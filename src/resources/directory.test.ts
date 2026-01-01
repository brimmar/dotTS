import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { DirectoryResource } from './directory';
import { FileSystem, FileSystemLive } from '../services/fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm, stat } from 'fs/promises';

describe('DirectoryResource', () => {
  const testDir = join(tmpdir(), 'dotts-dir-res-test-' + Math.random().toString(36).slice(2));

  const MockFS = (state: any) => Layer.succeed(FileSystem, FileSystem.of({
    mkdir: (path) => Effect.sync(() => { state.createdDir = path; state.exists = true; }),
    exists: (path) => Effect.sync(() => state.exists),
    rm: (path) => Effect.sync(() => { state.exists = false; }),
    chmod: (path, mode) => Effect.sync(() => { state.chmod = { path, mode }; }),
    chown: (path, uid, gid) => Effect.sync(() => { state.chown = { path, uid, gid }; }),
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

  it('should remove directory on destroy', async () => {
    const state: any = { exists: true };
    const app = new App();
    const stack = new Stack(app, 'test');
    const dirRes = new DirectoryResource(stack, 'my-dir', { path: '/tmp/test-dir' });

    await Effect.runPromise(Effect.provide(dirRes.destroy(), MockFS(state)));
    
    expect(state.exists).toBe(false);
  });
});

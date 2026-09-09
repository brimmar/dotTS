import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Effect, Layer } from 'effect';
import { App, Stack } from '../core/app';
import { UnarchiveResource } from './unarchive';
import { FileSystem, FileSystemLive } from '../services/fs';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm, mkdir, writeFile } from 'fs/promises';

describe('UnarchiveResource', () => {
  const testDir = join(tmpdir(), 'dotts-unarchive-test-' + Math.random().toString(36).slice(2));
  const srcDir = join(testDir, 'src');
  const destDir = join(testDir, 'dest');

  beforeAll(async () => {
    await mkdir(srcDir, { recursive: true });
    await mkdir(destDir, { recursive: true });
    
    // Create a dummy file to archive
    await writeFile(join(srcDir, 'hello.txt'), 'hello world');
    
    // Create a tar.gz archive using system tar
    const { execSync } = require('child_process');
    execSync(`tar -czf ${join(testDir, 'test.tar.gz')} -C ${srcDir} hello.txt`);
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should extract a tar.gz archive', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const archivePath = join(testDir, 'test.tar.gz');
    const extractPath = join(destDir, 'extract-tar');

    const unarchiveRes = new UnarchiveResource(stack, 'my-tar', {
      src: archivePath,
      dest: extractPath,
    });

    const program = unarchiveRes.apply();

    const MainLive = FileSystemLive.pipe(
      Layer.provideMerge(SystemCommandLive)
    );

    await Effect.runPromise(Effect.provide(program, MainLive));

    const fs = require('fs');
    expect(fs.existsSync(join(extractPath, 'hello.txt'))).toBe(true);
    expect(fs.readFileSync(join(extractPath, 'hello.txt'), 'utf8')).toBe('hello world');
  });

  it('should support stripComponents', async () => {
      // Create a nested structure
      const nestedSrc = join(testDir, 'nested-src');
      const innerDir = join(nestedSrc, 'top/middle');
      await mkdir(innerDir, { recursive: true });
      await writeFile(join(innerDir, 'data.txt'), 'nested data');

      const archivePath = join(testDir, 'nested.tar.gz');
      const { execSync } = require('child_process');
      execSync(`tar -czf ${archivePath} -C ${nestedSrc} top`);

      const app = new App();
      const stack = new Stack(app, 'test');
      const extractPath = join(destDir, 'extract-nested');

      const unarchiveRes = new UnarchiveResource(stack, 'nested-tar', {
          src: archivePath,
          dest: extractPath,
          stripComponents: 2,
      });

      const program = unarchiveRes.apply();
      const MainLive = FileSystemLive.pipe(Layer.provideMerge(SystemCommandLive));

      await Effect.runPromise(Effect.provide(program, MainLive));

      const fs = require('fs');
      // Should have stripped 'top/' and 'middle/'
      expect(fs.existsSync(join(extractPath, 'data.txt'))).toBe(true);
  });

  it('should extract a .zip archive', async () => {
    // Create a zip archive using system zip
    const zipSrc = join(testDir, 'zip-src');
    await mkdir(zipSrc, { recursive: true });
    await writeFile(join(zipSrc, 'zip-hello.txt'), 'hello zip');
    
    const archivePath = join(testDir, 'test.zip');
    const { execSync } = require('child_process');
    // Check if zip command exists
    try {
        execSync(`zip -j ${archivePath} ${join(zipSrc, 'zip-hello.txt')}`);
    } catch (e) {
        console.log('zip command not found, skipping zip test');
        return;
    }

    const app = new App();
    const stack = new Stack(app, 'test');
    const extractPath = join(destDir, 'extract-zip');

    const unarchiveRes = new UnarchiveResource(stack, 'my-zip', {
      src: archivePath,
      dest: extractPath,
    });

    const program = unarchiveRes.apply();
    const MainLive = FileSystemLive.pipe(Layer.provideMerge(SystemCommandLive));

    await Effect.runPromise(Effect.provide(program, MainLive));

    const fs = require('fs');
    expect(fs.existsSync(join(extractPath, 'zip-hello.txt'))).toBe(true);
  });

  it('should execFile unzip and tar with paths as argv', async () => {
    const calls: { file: string; args: string[] }[] = [];
    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      mkdir: () => Effect.void,
      writeFileBytes: () => Effect.void,
    } as any));
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.succeed(''),
      execFile: (file, args) => {
        calls.push({ file, args });
        return Effect.succeed('');
      },
    }));

    const app = new App();
    const stack = new Stack(app, 'test');
    const zipRes = new UnarchiveResource(stack, 'zip', {
      src: '/tmp/evil; id.zip',
      dest: '/tmp/out',
    });
    await Effect.runPromise(
      zipRes.apply().pipe(Effect.provide(MockFS), Effect.provide(MockExec))
    );
    expect(calls[0]).toEqual({
      file: 'unzip',
      args: ['-o', '/tmp/evil; id.zip', '-d', '/tmp/out'],
    });

    calls.length = 0;
    const tarRes = new UnarchiveResource(stack, 'tar', {
      src: '/tmp/a.tar.gz',
      dest: '/tmp/out',
      stripComponents: 1,
    });
    await Effect.runPromise(
      tarRes.apply().pipe(Effect.provide(MockFS), Effect.provide(MockExec))
    );
    expect(calls[0]).toEqual({
      file: 'tar',
      args: ['-xzf', '/tmp/a.tar.gz', '-C', '/tmp/out', '--strip-components=1'],
    });
  });

  it('should not rm dest on destroy', async () => {
    const rmCalls: string[] = [];
    const MockFS = Layer.succeed(FileSystem, FileSystem.of({
      rm: (path: string) => Effect.sync(() => { rmCalls.push(path); }),
      writeFileBytes: () => Effect.void,
    } as any));
    const MockExec = Layer.succeed(SystemCommand, SystemCommand.of({
      run: () => Effect.succeed(''),
      execFile: () => Effect.succeed(''),
    }));

    const app = new App();
    const stack = new Stack(app, 'test');
    const unarchiveRes = new UnarchiveResource(stack, 'my-tar', {
      src: '/tmp/a.tar.gz',
      dest: '/tmp/extract',
    });

    await Effect.runPromise(
      unarchiveRes.destroy().pipe(
        Effect.provide(MockFS),
        Effect.provide(MockExec)
      )
    );

    expect(rmCalls).toEqual([]);
  });
});

import { describe, it, expect } from 'bun:test';
import { Effect } from 'effect';
import { App, Stack } from '../core/app';
import { SymlinkResource } from './symlink';
import { FileSystemLive } from '../services/fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm, lstat, writeFile, mkdir } from 'fs/promises';

describe('SymlinkResource', () => {
  const testDir = join(tmpdir(), 'dotts-link-res-test-' + Math.random().toString(36).slice(2));

  it('should create a symlink at the specified path', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    await mkdir(testDir, { recursive: true });
    const targetPath = join(testDir, 'target.txt');
    const linkPath = join(testDir, 'link.txt');
    await writeFile(targetPath, 'target content');
    
    const linkRes = new SymlinkResource(stack, 'my-link', {
      source: targetPath,
      path: linkPath,
    });

    const program = linkRes.apply();
    
    await Effect.runPromise(Effect.provide(program, FileSystemLive));
    
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);

    await rm(testDir, { recursive: true, force: true });
  });
});

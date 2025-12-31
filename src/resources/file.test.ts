import { describe, it, expect } from 'bun:test';
import { Effect } from 'effect';
import { App, Stack } from '../core/app';
import { FileResource } from './file';
import { FileSystem, FileSystemLive } from '../services/fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm, readFile } from 'fs/promises';

describe('FileResource', () => {
  const testDir = join(tmpdir(), 'dotts-file-res-test-' + Math.random().toString(36).slice(2));

  it('should write file content to the specified path', async () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const filePath = join(testDir, 'test-file.txt');
    const content = 'hello resource';
    
    const fileRes = new FileResource(stack, 'my-file', {
      path: filePath,
      content: content,
    });

    const program = fileRes.apply();
    
    await Effect.runPromise(Effect.provide(program, FileSystemLive));
    
    const actualContent = await readFile(filePath, 'utf-8');
    expect(actualContent).toBe(content);

    await rm(testDir, { recursive: true, force: true });
  });
});

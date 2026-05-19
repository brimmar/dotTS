import { describe, expect, it } from 'bun:test';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dottsApply } from './commands/apply';
import { Effect } from 'effect';
import { FileSystemLive } from './services/fs';

describe('dotts apply', () => {
  const testDir = join(tmpdir(), 'dotts-apply-test-' + Math.random().toString(36).slice(2));

  it('should load and validate a dotts.ts file', async () => {
    const configPath = join(testDir, 'dotts-apply-ok.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'test-config',
        packages: [],
        symlinks: [],
        files: [],
        directories: [],
        scripts: []
      };
    `);

    // Note: dottsApply is an async function that handles its own Effect running
    // We expect it to work without additional wrapping
    await dottsApply(configPath);
  });

  it('should throw an error if dotts.ts is missing', async () => {
    expect(dottsApply(join(testDir, 'non-existent.ts'))).rejects.toThrow();
  });
});
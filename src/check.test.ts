import { describe, expect, it, afterEach } from 'bun:test';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dottsCheck } from './commands/check';

describe('dotts check', () => {
  const testDir = join(tmpdir(), 'dotts-check-test-' + Math.random().toString(36).slice(2));

  afterEach(async () => {
    // We keep the dir between tests but use unique filenames
  });

  it('should validate a correct configuration', async () => {
    const configPath = join(testDir, 'dotts-ok.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'test-config',
        packages: [],
        symlinks: [],
        files: [],
      };
    `);

    await dottsCheck(configPath);
  });

  it('should fail on invalid configuration', async () => {
    const configPath = join(testDir, 'dotts-fail.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'test-config',
        packages: [{ name: 'test', manager: 'invalid' }], 
        symlinks: [],
        files: [],
      };
    `);

    expect(dottsCheck(configPath)).rejects.toThrow();
  });
});
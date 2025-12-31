import { describe, expect, it, afterEach } from 'bun:test';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dottsApply } from './commands/apply';

describe('dotts apply', () => {
  const testDir = join(tmpdir(), 'dotts-apply-test-' + Math.random().toString(36).slice(2));
  const configPath = join(testDir, 'dotts.ts');

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load and validate a dotts.ts file', async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'test-config',
        packages: [],
        symlinks: [],
        files: [],
      };
    `);

    // The function should not throw if the config is valid
    await dottsApply(configPath);
  });

  it('should throw an error if dotts.ts is missing', async () => {
    expect(dottsApply(join(testDir, 'non-existent.ts'))).rejects.toThrow();
  });
});

import { afterEach, describe, expect, it } from 'bun:test';
import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dottsCheck } from './commands/check';

describe('dotts check', () => {
  const testDir = join(tmpdir(), `dotts-check-test-${Math.random().toString(36).slice(2)}`);

  afterEach(async () => {
    if (await exists(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  async function writeTypes(): Promise<void> {
    const typesDir = join(testDir, '.dotts', 'types');
    await mkdir(typesDir, { recursive: true });
    await writeFile(join(typesDir, 'index.d.ts'), 'export declare function pkg(name: string): { id: string };\n');
  }

  it('should validate a correct configuration', async () => {
    await mkdir(testDir, { recursive: true });
    await writeTypes();
    const configPath = join(testDir, 'dotts-ok.ts');
    await writeFile(
      configPath,
      `
      export const config = {
        name: 'test-config',
        packages: [],
        symlinks: [],
        files: [],
      };
    `,
    );

    await dottsCheck(configPath);
  });

  it('should fail on invalid configuration', async () => {
    await mkdir(testDir, { recursive: true });
    await writeTypes();
    const configPath = join(testDir, 'dotts-fail.ts');
    await writeFile(
      configPath,
      `
      export const config = {
        name: 'test-config',
        packages: [{ name: 'test', manager: 'invalid' }],
        symlinks: [],
        files: [],
      };
    `,
    );

    await expect(dottsCheck(configPath)).rejects.toThrow();
  });

  it('rejects a type error before loading the config', async () => {
    await mkdir(testDir, { recursive: true });
    await writeTypes();
    const configPath = join(testDir, 'dotts.ts');
    const marker = join(testDir, 'loaded.txt');
    await writeFile(
      configPath,
      `import { writeFileSync } from 'node:fs';
import { pkg } from 'dotts';
writeFileSync(${JSON.stringify(marker)}, 'loaded');
export default () => {
  pkg(1);
};
`,
    );

    await expect(dottsCheck(configPath)).rejects.toThrow();
    expect(await exists(marker)).toBe(false);
  });
});

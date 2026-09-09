import { afterEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { typecheckFile } from './typecheck';

describe('typecheckFile', () => {
  const dir = join(tmpdir(), `dotts-typecheck-${Math.random().toString(36).slice(2)}`);

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeFixtureTypes(): Promise<string> {
    const typesDir = join(dir, '.dotts', 'types');
    await mkdir(typesDir, { recursive: true });
    await writeFile(join(typesDir, 'index.d.ts'), 'export declare function pkg(name: string): { id: string };\n');
    return typesDir;
  }

  it('returns [] for a valid config', async () => {
    const typesDir = await writeFixtureTypes();
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { pkg } from 'dotts';\nexport default () => {\n  pkg('git');\n};\n`,
    );

    expect(typecheckFile({ configPath, typesDir })).toEqual([]);
  });

  it('reports pkg(1) with a line > 0', async () => {
    const typesDir = await writeFixtureTypes();
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { pkg } from 'dotts';\nexport default () => {\n  pkg(1);\n};\n`,
    );

    const diagnostics = typecheckFile({ configPath, typesDir });
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(
      diagnostics.some(
        (d) =>
          d.line > 0 &&
          (d.message.includes('number') ||
            d.message.includes('string') ||
            d.message.toLowerCase().includes('argument')),
      ),
    ).toBe(true);
  });

  it('accepts node:fs when @types/node is available', async () => {
    const typesDir = await writeFixtureTypes();
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { readFileSync } from 'node:fs';
import { pkg } from 'dotts';
export default () => {
  pkg('git');
  readFileSync('/etc/os-release', 'utf8');
};
`,
    );

    expect(typecheckFile({ configPath, typesDir })).toEqual([]);
  });

  it('ignores suggestion diagnostics from dependencies', async () => {
    const typesDir = await writeFixtureTypes();
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { pkg } from 'dotts';
export default () => {
  pkg('git');
};
`,
    );

    const diagnostics = typecheckFile({ configPath, typesDir });
    expect(diagnostics.every((d) => d.file === configPath || d.file.startsWith(dir))).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('tells the user to run prepare when types are missing', async () => {
    await mkdir(dir, { recursive: true });
    const configPath = join(dir, 'dotts.ts');
    await writeFile(configPath, `import { pkg } from 'dotts';\n`);

    const diagnostics = typecheckFile({
      configPath,
      typesDir: join(dir, '.dotts', 'types'),
    });
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some((d) => d.message.toLowerCase().includes('prepare'))).toBe(true);
  });
});

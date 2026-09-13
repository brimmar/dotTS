import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureEmbeddedTypes, typecheckFile } from './typecheck';

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

  it('accepts node:fs when Node types are available', async () => {
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

  it('accepts node:fs and fetch using only embedded typeRoots', async () => {
    const typesDir = await writeFixtureTypes();
    const embedded = resolve(join(import.meta.dir, '../embedded/types'));
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { readFileSync } from 'node:fs';
import { pkg } from 'dotts';
export default () => {
  pkg('git');
  readFileSync('/etc/os-release', 'utf8');
  void fetch('https://example.com');
};
`,
    );

    expect(typecheckFile({ configPath, typesDir, typeRoots: [embedded] })).toEqual([]);
  });

  it('re-extracts a partial dest without .complete including undici-types', async () => {
    const typesDir = await writeFixtureTypes();
    const missingSource = join(dir, 'no-embedded-types');
    const dest = ensureEmbeddedTypes(missingSource);
    expect(existsSync(join(dest, '.complete'))).toBe(true);
    expect(existsSync(join(dest, 'undici-types', 'index.d.ts'))).toBe(true);

    rmSync(join(dest, '.complete'), { force: true });
    rmSync(join(dest, 'undici-types'), { recursive: true, force: true });
    mkdirSync(join(dest, 'node'), { recursive: true });
    writeFileSync(join(dest, 'node', 'index.d.ts'), 'partial');

    const extracted = ensureEmbeddedTypes(missingSource);
    expect(existsSync(join(extracted, '.complete'))).toBe(true);
    expect(existsSync(join(extracted, 'undici-types', 'index.d.ts'))).toBe(true);
    expect(readFileSync(join(extracted, 'node', 'index.d.ts'), 'utf8')).not.toBe('partial');

    const configPath = join(dir, 'dotts-extract.ts');
    await writeFile(
      configPath,
      `import { readFileSync } from 'node:fs';
import { pkg } from 'dotts';
export default () => {
  pkg('git');
  readFileSync('/etc/os-release', 'utf8');
  void fetch('https://example.com');
};
`,
    );
    expect(typecheckFile({ configPath, typesDir, typeRoots: [extracted] })).toEqual([]);
  });

  it('fails on a type error in a helper imported from a parent directory', async () => {
    const typesDir = await writeFixtureTypes();
    const sharedDir = join(dir, 'shared');
    const projectDir = join(dir, 'project');
    await mkdir(sharedDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(sharedDir, 'helper.ts'), 'export const n: number = "nope";\n');
    const configPath = join(projectDir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { pkg } from 'dotts';
import { n } from '../shared/helper';
export default () => {
  pkg('git');
  void n;
};
`,
    );

    const diagnostics = typecheckFile({ configPath, typesDir });
    expect(diagnostics.some((d) => d.file.includes('helper.ts') && d.message.toLowerCase().includes('string'))).toBe(
      true,
    );
  });

  it('does not fail on suggestion-only diagnostics', async () => {
    const typesDir = join(dir, '.dotts', 'types');
    await mkdir(typesDir, { recursive: true });
    await writeFile(
      join(typesDir, 'index.d.ts'),
      `/** @deprecated use pkg2 */
export declare function pkg(name: string): { id: string };
`,
    );
    const configPath = join(dir, 'dotts.ts');
    await writeFile(
      configPath,
      `import { pkg } from 'dotts';
export default () => {
  pkg('git');
};
`,
    );

    expect(typecheckFile({ configPath, typesDir })).toEqual([]);
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

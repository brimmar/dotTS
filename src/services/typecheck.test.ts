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

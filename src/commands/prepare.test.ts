import { afterEach, describe, expect, it } from 'bun:test';
import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DottsError } from '../core/errors';
import { dottsPrepare, tsconfigJson } from './prepare';

describe('dotts prepare', () => {
  const testProjectDir = join(tmpdir(), `dotts-test-prepare-${Math.random().toString(36).slice(2)}`);

  afterEach(async () => {
    if (await exists(testProjectDir)) {
      await rm(testProjectDir, { recursive: true, force: true });
    }
  });

  it('preserves an existing dotts.ts body and rewrites types', async () => {
    await mkdir(testProjectDir, { recursive: true });
    const custom = '// keep me\nexport default () => {};\n';
    await writeFile(join(testProjectDir, 'dotts.ts'), custom);

    await dottsPrepare(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'dotts.ts')).text()).toBe(custom);
    const dts = await Bun.file(join(testProjectDir, '.dotts/types/index.d.ts')).text();
    expect(dts).toContain('pkg');
    expect(dts.includes('declare') || dts.includes('export function pkg')).toBe(true);
  });

  it('merges paths.dotts into an existing tsconfig without clobbering other fields', async () => {
    await mkdir(testProjectDir, { recursive: true });
    await writeFile(
      join(testProjectDir, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            strict: false,
            target: 'ES2020',
            paths: { '@lib/*': ['./lib/*'] },
          },
          include: ['src/**/*.ts'],
        },
        null,
        2,
      )}\n`,
    );

    await dottsPrepare(testProjectDir);

    const tsconfig = JSON.parse(await Bun.file(join(testProjectDir, 'tsconfig.json')).text());
    expect(tsconfig).toEqual({
      compilerOptions: {
        strict: false,
        target: 'ES2020',
        paths: {
          '@lib/*': ['./lib/*'],
          dotts: ['./.dotts/types'],
        },
      },
      include: ['src/**/*.ts'],
    });
  });

  it('leaves tsconfig.json unchanged when paths.dotts already exists', async () => {
    await mkdir(testProjectDir, { recursive: true });
    const existing = '{\n  "compilerOptions": {\n    "paths": {\n      "dotts": ["./custom"]\n    }\n  }\n}\n';
    await writeFile(join(testProjectDir, 'tsconfig.json'), existing);

    await dottsPrepare(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()).toBe(existing);
  });

  it('writes tsconfig.json with paths.dotts when missing', async () => {
    await dottsPrepare(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()).toBe(tsconfigJson());
  });

  it('merges paths.dotts into a JSONC tsconfig with comments', async () => {
    await mkdir(testProjectDir, { recursive: true });
    await writeFile(
      join(testProjectDir, 'tsconfig.json'),
      `{
  // Visit https://aka.ms/tsconfig to read more about this file
  "compilerOptions": {
    /* Language and Environment */
    "strict": true,
    "target": "ESNext"
  },
  "include": ["src/**/*.ts"]
}
`,
    );

    await dottsPrepare(testProjectDir);

    const tsconfig = JSON.parse(await Bun.file(join(testProjectDir, 'tsconfig.json')).text());
    expect(tsconfig.compilerOptions.paths.dotts).toEqual(['./.dotts/types']);
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.target).toBe('ESNext');
    expect(tsconfig.include).toEqual(['src/**/*.ts']);
    expect(await exists(join(testProjectDir, '.dotts/types/index.d.ts'))).toBe(true);
  });

  it('throws DottsError when tsconfig.json is invalid JSONC', async () => {
    await mkdir(testProjectDir, { recursive: true });
    await writeFile(join(testProjectDir, 'tsconfig.json'), '{ this is not json');

    const err = await dottsPrepare(testProjectDir).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DottsError);
    expect(err).not.toBeInstanceOf(SyntaxError);
    expect((err as DottsError).message).toMatch(/Could not parse/);
    expect((err as DottsError).hint).toMatch(/JSON\/JSONC/);
  });
});

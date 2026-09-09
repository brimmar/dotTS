import { afterEach, describe, expect, it } from 'bun:test';
import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dottsPrepare } from './prepare';

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

  it('does not overwrite an existing tsconfig.json', async () => {
    await mkdir(testProjectDir, { recursive: true });
    const existing = '{\n  "keep": true\n}\n';
    await writeFile(join(testProjectDir, 'tsconfig.json'), existing);

    await dottsPrepare(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()).toBe(existing);
  });

  it('writes tsconfig.json with paths.dotts when missing', async () => {
    await dottsPrepare(testProjectDir);

    const tsconfig = JSON.parse(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()) as {
      compilerOptions: { paths: { dotts: string[] } };
    };
    expect(tsconfig.compilerOptions.paths.dotts).toEqual(['./.dotts/types']);
  });
});

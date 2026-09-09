import { afterEach, describe, expect, it } from 'bun:test';
import { exists, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dottsInit } from './commands/init';

function exportedNames(src: string): string[] {
  const names: string[] = [];
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const match of stripped.matchAll(/export\s+(?:type|class|function|const|interface|enum)\s+(\w+)/g)) {
    if (match[1]) names.push(match[1]);
  }
  for (const match of stripped.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    const body = match[1];
    if (!body) continue;
    for (const part of body.split(',')) {
      const id = part.trim();
      if (!id) continue;
      const name = id.split(/\s+as\s+/).pop()?.trim();
      if (name && /^\w+$/.test(name)) names.push(name);
    }
  }
  return [...new Set(names)];
}

describe('dotts init', () => {
  const testProjectDir = join(tmpdir(), `dotts-test-project-${Math.random().toString(36).slice(2)}`);

  afterEach(async () => {
    if (await exists(testProjectDir)) {
      await rm(testProjectDir, { recursive: true, force: true });
    }
  });

  it('writes a project that imports from dotts, not this repo', async () => {
    await dottsInit(testProjectDir);

    expect(await exists(testProjectDir)).toBe(true);
    const content = await Bun.file(join(testProjectDir, 'dotts.ts')).text();
    expect(content).toContain("from 'dotts'");
    expect(content).not.toContain('src/public');
    expect(content).toContain("onPlatform('darwin'");
    expect(content).toContain("onDistro('ubuntu'");
  });

  it('writes tsconfig.json with paths.dotts', async () => {
    await dottsInit(testProjectDir);

    const tsconfig = JSON.parse(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()) as {
      compilerOptions: { paths: { dotts: string[] } };
    };
    expect(tsconfig.compilerOptions.paths.dotts).toEqual(['./.dotts/types']);
  });

  it('writes .dotts/types/index.d.ts describing pkg', async () => {
    await dottsInit(testProjectDir);

    const dts = await Bun.file(join(testProjectDir, '.dotts/types/index.d.ts')).text();
    expect(dts.includes('declare') || dts.includes('export function pkg')).toBe(true);
    expect(dts).toContain('pkg');
  });
});

describe('embedded public API types', () => {
  it('names every export from src/public.ts', async () => {
    const src = await Bun.file(join(import.meta.dir, 'public.ts')).text();
    const dts = await Bun.file(join(import.meta.dir, 'embedded/public-api.d.ts')).text();
    const missing = exportedNames(src).filter((name) => !dts.includes(name));
    expect(missing).toEqual([]);
  });
});

import { afterEach, describe, expect, it } from 'bun:test';
import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DottsError } from './core/errors';
import { dottsInit, parseInitArgs } from './commands/init';
import { tsconfigJson } from './commands/prepare';

function exportedNames(src: string): Set<string> {
  const names = new Set<string>();
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const match of stripped.matchAll(
    /export\s+(?:declare\s+)?(?:type|class|function|const|interface|enum)\s+(\w+)/g,
  )) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of stripped.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    const body = match[1];
    if (!body) continue;
    for (const part of body.split(',')) {
      const id = part.trim();
      if (!id) continue;
      const name = id.split(/\s+as\s+/).pop()?.trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    }
  }
  return names;
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
    expect(content).toContain("pkg('build-essential')");
  });

  it('does not treat --force as the project directory', () => {
    expect(parseInitArgs(['--force'])).toEqual({ projectDir: './my-dotfiles', force: true });
    expect(parseInitArgs(['--force', './x'])).toEqual({ projectDir: './x', force: true });
    expect(parseInitArgs(['./x', '--force'])).toEqual({ projectDir: './x', force: true });
    expect(parseInitArgs([])).toEqual({ projectDir: './my-dotfiles', force: false });
  });

  it('refuses to re-init when dotts.ts exists unless force is set', async () => {
    await mkdir(testProjectDir, { recursive: true });
    const existing = '// keep me\nexport default () => {};\n';
    await writeFile(join(testProjectDir, 'dotts.ts'), existing);

    await expect(dottsInit(testProjectDir)).rejects.toThrow(DottsError);
    await expect(dottsInit(testProjectDir)).rejects.toThrow(/Refusing to overwrite/);
    expect(await Bun.file(join(testProjectDir, 'dotts.ts')).text()).toBe(existing);

    await dottsInit(testProjectDir, { force: true });
    const content = await Bun.file(join(testProjectDir, 'dotts.ts')).text();
    expect(content).toContain("from 'dotts'");
    expect(content).not.toContain('keep me');
  });

  it('writes tsconfig.json and .gitignore when missing', async () => {
    await dottsInit(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()).toBe(tsconfigJson());
    expect(await Bun.file(join(testProjectDir, '.gitignore')).text()).toBe(
      `node_modules
.dotts/state.json
.dotts/secrets.json
`,
    );
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

    await dottsInit(testProjectDir);

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

    await dottsInit(testProjectDir);

    expect(await Bun.file(join(testProjectDir, 'tsconfig.json')).text()).toBe(existing);
  });

  it('does not overwrite an existing .gitignore', async () => {
    await mkdir(testProjectDir, { recursive: true });
    const existing = 'dist\n*.log\n';
    await writeFile(join(testProjectDir, '.gitignore'), existing);

    await dottsInit(testProjectDir);

    expect(await Bun.file(join(testProjectDir, '.gitignore')).text()).toBe(existing);
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
    const srcNames = exportedNames(src);
    const dtsNames = exportedNames(dts);
    const missing = [...srcNames].filter((name) => !dtsNames.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it('onPlatform and onDistro callbacks receive api', async () => {
    const dts = await Bun.file(join(import.meta.dir, 'embedded/public-api.d.ts')).text();
    expect(dts).toContain('fn: (api: CommonApi)');
    expect(dts).toContain('fn: (api: ApiFor<O>)');
    expect(dts).toContain('fn: (api: LinuxApi)');
    expect(dts).toContain('fn: (api: ArchApi)');
    expect(dts).toContain('fn: (api: DistroApiFor<D>)');
  });
});

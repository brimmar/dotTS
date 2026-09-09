import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Bun embeds this asset in `bun build --compile`. dist/public.d.ts is not a
// single file (it imports ./public-props and ./core/secret), so init/prepare
// ship a bundled fallback instead. tsc types a .d.ts import as a namespace;
// at runtime Bun returns a path string.
// @ts-expect-error TS2846 declaration files cannot be imported as values
import publicApiDts from '../embedded/public-api.d.ts' with { type: 'file' };

const TSCONFIG = {
  compilerOptions: {
    strict: true,
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'bundler',
    noEmit: true,
    skipLibCheck: true,
    paths: {
      dotts: ['./.dotts/types'],
    },
  },
  include: ['./*.ts'],
};

export function tsconfigJson(): string {
  return `${JSON.stringify(TSCONFIG, null, 2)}\n`;
}

async function cliVersion(): Promise<string> {
  try {
    const parsed = JSON.parse(await Bun.file(join(import.meta.dir, '../../package.json')).text()) as {
      version?: string;
    };
    if (parsed.version) return parsed.version;
  } catch {
    // Compiled binaries may not include package.json next to the source tree.
  }
  return '0.1.0';
}

async function writeEditorTypes(projectDir: string): Promise<void> {
  const typesDir = join(projectDir, '.dotts', 'types');
  await rm(typesDir, { recursive: true, force: true });
  await mkdir(typesDir, { recursive: true });

  const dts = await Bun.file(publicApiDts as unknown as string).text();
  await writeFile(join(typesDir, 'index.d.ts'), dts);

  const version = await cliVersion();
  await writeFile(
    join(typesDir, 'package.json'),
    `${JSON.stringify({ name: 'dotts', version, types: 'index.d.ts' }, null, 2)}\n`,
  );
}

export async function dottsPrepare(projectDir: string = process.cwd()): Promise<void> {
  await mkdir(projectDir, { recursive: true });

  const tsconfigPath = join(projectDir, 'tsconfig.json');
  if (!(await exists(tsconfigPath))) {
    await writeFile(tsconfigPath, tsconfigJson());
  }

  await writeEditorTypes(projectDir);
}

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'src/embedded/public-api.d.ts');

function dropModuleSpecifiers(src: string): string {
  return src
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+type\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+\{[^}]*SecretToken[^}]*\};?\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function secretTokenDecl(src: string): string {
  const match = src.match(/export declare class SecretToken \{[\s\S]*?\n\}/);
  if (!match) {
    throw new Error('SecretToken class missing from secret.d.ts');
  }
  return match[0];
}

function publicPropsTypes(src: string): string {
  const cut = src.search(/\/\*\* Constructor stubs/);
  const body = cut === -1 ? src : src.slice(0, cut);
  return dropModuleSpecifiers(body);
}

export async function generatePublicApiDts(): Promise<string> {
  const outDir = await mkdtemp(join(tmpdir(), 'dotts-public-api-dts-'));
  try {
    const tsc = join(root, 'node_modules/typescript/bin/tsc');
    const proc = Bun.spawn(['bun', tsc, '--project', 'tsconfig.npm.json', '--outDir', outDir], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) {
      throw new Error(`tsc failed (${exitCode}):\n${stdout}\n${stderr}`);
    }

    const [secretDts, propsDts, publicDts] = await Promise.all([
      readFile(join(outDir, 'core/secret.d.ts'), 'utf8'),
      readFile(join(outDir, 'public-props.d.ts'), 'utf8'),
      readFile(join(outDir, 'public.d.ts'), 'utf8'),
    ]);

    return `${secretTokenDecl(secretDts)}\n\n${publicPropsTypes(propsDts)}\n\n${dropModuleSpecifiers(publicDts)}\n`;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const dts = await generatePublicApiDts();
  await writeFile(outFile, dts);
}

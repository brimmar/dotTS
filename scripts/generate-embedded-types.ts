import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(join(import.meta.dir, '..'));
const TS_LIB_DIR = join(ROOT, 'node_modules/typescript/lib');
const EMBEDDED_DIR = join(ROOT, 'src/embedded/types');
const LIB_DEST_DIR = join(EMBEDDED_DIR, 'lib');
const OUT_FILE = join(ROOT, 'src/embedded/node-types-assets.ts');

// Trace required lib files starting from lib.esnext.d.ts and lib.esnext.full.d.ts
const tracedFiles = new Set<string>();
function traceLib(name: string) {
  if (tracedFiles.has(name)) return;
  tracedFiles.add(name);
  const p = join(TS_LIB_DIR, name);
  if (!existsSync(p)) return;
  const content = readFileSync(p, 'utf8');
  for (const match of content.matchAll(/<reference\s+lib="([^"]+)"/g)) {
    traceLib(`lib.${match[1]}.d.ts`);
  }
}

traceLib('lib.esnext.d.ts');
traceLib('lib.esnext.full.d.ts');

mkdirSync(LIB_DEST_DIR, { recursive: true });
for (const f of tracedFiles) {
  const src = join(TS_LIB_DIR, f);
  if (existsSync(src)) {
    copyFileSync(src, join(LIB_DEST_DIR, f));
  }
}

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const allFiles = walk(EMBEDDED_DIR).sort();
const hasher = createHash('sha256');

const entries: Array<{ rel: string; importName: string; importPath: string }> = [];

for (let i = 0; i < allFiles.length; i++) {
  const full = allFiles[i];
  const content = readFileSync(full);
  hasher.update(content);
  const rel = relative(EMBEDDED_DIR, full).replace(/\\/g, '/');
  entries.push({
    rel,
    importName: `f${i}`,
    importPath: `./types/${rel}`,
  });
}

const stamp = hasher.digest('hex').slice(0, 16);

let out = `/* generated from @types/node, undici-types, and typescript/lib — do not edit */\n// @ts-nocheck\n\n`;
out += `export const embeddedTypesStamp = "${stamp}";\n\n`;

for (const { importName, importPath } of entries) {
  out += `import ${importName} from '${importPath}' with { type: 'file' };\n`;
}

out += `\nexport const nodeTypeAssets: Record<string, string> = {\n`;
for (const { rel, importName } of entries) {
  out += `  ${JSON.stringify(rel)}: ${importName},\n`;
}
out += `};\n`;

writeFileSync(OUT_FILE, out);
console.log(`Generated ${OUT_FILE} with ${entries.length} assets (stamp: ${stamp})`);

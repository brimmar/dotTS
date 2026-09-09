import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as ts from 'typescript';
import { nodeTypeAssets } from '../embedded/node-types-assets';

export interface TypecheckDiagnostic {
  file: string;
  line: number; // 1-based
  column: number; // 1-based
  message: string;
  code: number;
}

function mapDiagnostic(diagnostic: ts.Diagnostic): TypecheckDiagnostic {
  let line = 0;
  let column = 0;
  const file = diagnostic.file?.fileName ?? '';
  if (diagnostic.file && diagnostic.start !== undefined) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    line = pos.line + 1;
    column = pos.character + 1;
  }
  return {
    file,
    line,
    column,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    code: diagnostic.code,
  };
}

function ensureEmbeddedTypes(): string {
  const fromSource = resolve(join(import.meta.dir, '../embedded/types'));
  if (existsSync(join(fromSource, 'node', 'index.d.ts'))) return fromSource;

  const dest = join(tmpdir(), 'dotts-embedded-types');
  for (const [rel, assetPath] of Object.entries(nodeTypeAssets)) {
    const file = join(dest, 'node', rel);
    if (existsSync(file)) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, readFileSync(assetPath));
  }
  return dest;
}

function cliTypeRoots(): string[] {
  const roots: string[] = [];
  const embedded = ensureEmbeddedTypes();
  if (existsSync(join(embedded, 'node'))) roots.push(embedded);

  for (const candidate of [
    join(import.meta.dir, '../../node_modules/@types'),
    join(import.meta.dir, '../node_modules/@types'),
  ]) {
    if (existsSync(candidate)) roots.push(resolve(candidate));
  }
  return [...new Set(roots)];
}

function isIgnoredFile(program: ts.Program, fileName: string): boolean {
  const sourceFile = program.getSourceFile(fileName);
  if (sourceFile && program.isSourceFileDefaultLibrary(sourceFile)) return true;
  const name = fileName.replace(/\\/g, '/');
  if (name.includes('/node_modules/')) return true;
  const base = name.split('/').pop() ?? '';
  return base.startsWith('lib.') && base.endsWith('.d.ts');
}

export function typecheckFile(opts: {
  configPath: string;
  typesDir: string;
}): TypecheckDiagnostic[] {
  if (!existsSync(opts.typesDir)) {
    return [
      {
        file: opts.configPath,
        line: 1,
        column: 1,
        message: 'Missing .dotts/types. Run `dotts prepare` or `dotts init` first.',
        code: 0,
      },
    ];
  }

  const typeRoots = cliTypeRoots();
  const nodeTypes = typeRoots.some((root) => existsSync(join(root, 'node')));

  const options: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.esnext.d.ts'],
    noEmit: true,
    skipLibCheck: true,
    paths: { dotts: [opts.typesDir] },
    baseUrl: dirname(opts.configPath),
    // TS 6 errors on deprecated baseUrl unless this is set.
    ignoreDeprecations: '6.0',
  };
  if (typeRoots.length > 0) {
    options.typeRoots = typeRoots;
  }
  if (nodeTypes) {
    options.types = ['node'];
  }

  const program = ts.createProgram({
    rootNames: [opts.configPath],
    options,
  });

  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .filter((diagnostic) => !diagnostic.file || !isIgnoredFile(program, diagnostic.file.fileName))
    .map(mapDiagnostic);
}

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as ts from 'typescript';

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

function cliTypeRoots(): string[] {
  const here = import.meta.dir;
  const candidates = [join(here, '../../node_modules/@types'), join(here, '../node_modules/@types')];
  return [...new Set(candidates.filter((dir) => existsSync(dir)))];
}

function inConfigGraph(fileName: string, configPath: string, typesDir: string): boolean {
  const file = resolve(fileName);
  const config = resolve(configPath);
  const types = resolve(typesDir);
  const root = dirname(config);

  if (file === config) return true;
  if (file === types || file.startsWith(`${types}/`)) return true;
  if (!file.startsWith(`${root}/`)) return false;
  return !file.includes('/node_modules/');
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

  const program = ts.createProgram({
    rootNames: [opts.configPath],
    options: {
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
      ...(typeRoots.length > 0 ? { typeRoots } : {}),
      ...(nodeTypes ? { types: ['node'] } : {}),
    },
  });

  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .filter((diagnostic) => !diagnostic.file || inConfigGraph(diagnostic.file.fileName, opts.configPath, opts.typesDir))
    .map(mapDiagnostic);
}

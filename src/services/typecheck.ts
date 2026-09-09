import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
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

  const program = ts.createProgram({
    rootNames: [opts.configPath],
    options: {
      strict: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      paths: { dotts: [opts.typesDir] },
      baseUrl: dirname(opts.configPath),
      // TS 6 errors on deprecated baseUrl unless this is set.
      ignoreDeprecations: '6.0',
    },
  });

  return ts.getPreEmitDiagnostics(program).map(mapDiagnostic);
}

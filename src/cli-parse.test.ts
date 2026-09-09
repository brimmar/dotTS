import { describe, expect, it } from 'bun:test';
import { parseArgv } from './cli-parse';

describe('parseArgv', () => {
  it("parses ['prepare'] as prepare with default dir", () => {
    const req = parseArgv(['prepare']);
    expect(req.kind).toBe('prepare');
    if (req.kind !== 'prepare') return;
    expect(req.dir).toBe(process.cwd());
  });

  it("parses ['prepare', './x'] with dir ./x", () => {
    const req = parseArgv(['prepare', './x']);
    expect(req).toEqual({ kind: 'prepare', dir: './x' });
  });

  it("parses ['secrets', 'remove', 'FOO']", () => {
    const req = parseArgv(['secrets', 'remove', 'FOO']);
    expect(req).toEqual({ kind: 'secrets-remove', name: 'FOO' });
  });

  it("errors on ['secrets', 'remove'] without a name", () => {
    expect(() => parseArgv(['secrets', 'remove'])).toThrow('Usage: dotts secrets remove <name>');
  });

  it("parses ['--help'] as help, not interactive", () => {
    const req = parseArgv(['--help']);
    expect(req.kind).toBe('help');
    expect(req.kind).not.toBe('interactive');
  });

  it("parses ['apply', 'f.ts', '--dry-run'] with dryRun true", () => {
    const req = parseArgv(['apply', 'f.ts', '--dry-run']);
    expect(req).toEqual({ kind: 'apply', configPath: 'f.ts', dryRun: true });
  });
});

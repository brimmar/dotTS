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

  it("parses ['-h'] and ['apply', '--help'] as help", () => {
    expect(parseArgv(['-h']).kind).toBe('help');
    expect(parseArgv(['apply', '--help']).kind).toBe('help');
    expect(parseArgv(['apply', '-h']).kind).toBe('help');
  });

  it("parses ['apply', 'f.ts', '--dry-run'] with dryRun true", () => {
    const req = parseArgv(['apply', 'f.ts', '--dry-run']);
    expect(req).toEqual({ kind: 'apply', configPath: 'f.ts', dryRun: true });
  });

  it("rejects unknown apply flags such as --dryrun", () => {
    expect(() => parseArgv(['apply', '--dryrun'])).toThrow('Unknown flag: --dryrun');
    expect(() => parseArgv(['apply', '--dry-ru'])).toThrow('Unknown flag: --dry-ru');
  });

  it('rejects unknown flags on init, prepare, and check', () => {
    expect(() => parseArgv(['init', '--dry-run'])).toThrow('Unknown flag: --dry-run');
    expect(() => parseArgv(['prepare', '--force'])).toThrow('Unknown flag: --force');
    expect(() => parseArgv(['check', '--dry-run'])).toThrow('Unknown flag: --dry-run');
  });

  it("parses ['init', '--force', './x'] with force true", () => {
    expect(parseArgv(['init', '--force', './x'])).toEqual({
      kind: 'init',
      projectDir: './x',
      force: true,
    });
    expect(parseArgv(['init', './x', '--force'])).toEqual({
      kind: 'init',
      projectDir: './x',
      force: true,
    });
  });

  it("treats ['secrets', 'set', 'API_KEY', '-h'] as a set value, not help", () => {
    expect(parseArgv(['secrets', 'set', 'API_KEY', '-h'])).toEqual({
      kind: 'secrets-set',
      name: 'API_KEY',
      value: '-h',
    });
  });
});

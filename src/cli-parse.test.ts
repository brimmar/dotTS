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

  it("parses ['--help'] and ['help'] as global help", () => {
    expect(parseArgv(['--help'])).toEqual({ kind: 'help' });
    expect(parseArgv(['-h'])).toEqual({ kind: 'help' });
    expect(parseArgv(['help'])).toEqual({ kind: 'help' });
  });

  it("parses contextual help for commands and subcommands", () => {
    expect(parseArgv(['apply', '--help'])).toEqual({ kind: 'help', command: 'apply' });
    expect(parseArgv(['apply', '-h'])).toEqual({ kind: 'help', command: 'apply' });
    expect(parseArgv(['apply', 'dotts.ts', '--help'])).toEqual({ kind: 'help', command: 'apply' });
    expect(parseArgv(['help', 'apply'])).toEqual({ kind: 'help', command: 'apply' });
    expect(parseArgv(['check', '--help'])).toEqual({ kind: 'help', command: 'check' });
    expect(parseArgv(['doctor', '-h'])).toEqual({ kind: 'help', command: 'doctor' });
    expect(parseArgv(['init', '--help'])).toEqual({ kind: 'help', command: 'init' });
    expect(parseArgv(['prepare', '--help'])).toEqual({ kind: 'help', command: 'prepare' });
    expect(parseArgv(['secrets', '--help'])).toEqual({ kind: 'help', command: 'secrets' });
    expect(parseArgv(['secrets', 'list', '--help'])).toEqual({
      kind: 'help',
      command: 'secrets',
      subcommand: 'list',
    });
    expect(parseArgv(['help', 'secrets', 'set'])).toEqual({
      kind: 'help',
      command: 'secrets',
      subcommand: 'set',
    });
  });

  it("parses version flags and commands", () => {
    expect(parseArgv(['--version'])).toEqual({ kind: 'version' });
    expect(parseArgv(['-v'])).toEqual({ kind: 'version' });
    expect(parseArgv(['-V'])).toEqual({ kind: 'version' });
    expect(parseArgv(['version'])).toEqual({ kind: 'version' });
    expect(parseArgv(['--version', '--json'])).toEqual({ kind: 'version', json: true });
    expect(parseArgv(['apply', '--version'])).toEqual({ kind: 'version' });
  });

  it("parses ['apply', 'f.ts', '--dry-run'] with dryRun true", () => {
    const req = parseArgv(['apply', 'f.ts', '--dry-run']);
    expect(req).toEqual({ kind: 'apply', configPath: 'f.ts', dryRun: true });
  });

  it("parses ['apply', 'f.ts', '--yes'] and -y with yes true", () => {
    expect(parseArgv(['apply', 'f.ts', '--yes'])).toEqual({
      kind: 'apply',
      configPath: 'f.ts',
      dryRun: false,
      yes: true,
    });
    expect(parseArgv(['apply', '-y'])).toEqual({
      kind: 'apply',
      configPath: './dotts.ts',
      dryRun: false,
      yes: true,
    });
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

  it("parses ['apply', '--verbose'] and ['apply', '-v'] with verbose true", () => {
    expect(parseArgv(['apply', '--verbose'])).toEqual({
      kind: 'apply',
      configPath: './dotts.ts',
      dryRun: false,
      verbose: true,
    });
    expect(parseArgv(['apply', '-v'])).toEqual({
      kind: 'apply',
      configPath: './dotts.ts',
      dryRun: false,
      verbose: true,
    });
  });

  it("parses ['apply', '--json'] with json true", () => {
    expect(parseArgv(['apply', '--json'])).toEqual({
      kind: 'apply',
      configPath: './dotts.ts',
      dryRun: false,
      json: true,
    });
  });

  it("parses combined flags for apply", () => {
    expect(parseArgv(['apply', 'my-dotts.ts', '-v', '--json', '--dry-run', '-y'])).toEqual({
      kind: 'apply',
      configPath: 'my-dotts.ts',
      dryRun: true,
      yes: true,
      verbose: true,
      json: true,
    });
  });

  it("parses ['check', '--json'] with json true", () => {
    expect(parseArgv(['check', '--json'])).toEqual({
      kind: 'check',
      configPath: './dotts.ts',
      json: true,
    });
    expect(parseArgv(['check', 'custom.ts', '--json'])).toEqual({
      kind: 'check',
      configPath: 'custom.ts',
      json: true,
    });
  });

  it("parses ['doctor', '--json'] with json true", () => {
    expect(parseArgv(['doctor', '--json'])).toEqual({
      kind: 'doctor',
      json: true,
    });
  });

  it("parses ['secrets', 'list', '--json'] with json true", () => {
    expect(parseArgv(['secrets', 'list', '--json'])).toEqual({
      kind: 'secrets-list',
      json: true,
    });
  });
});

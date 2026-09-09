import { describe, expect, it } from 'bun:test';
import { migrateStateId, migrateStateKeys } from './ids';

describe('migrateStateId', () => {
  it('converts hyphen prefixes to colon form when stored kind matches', () => {
    expect(migrateStateId('file-/tmp/a', 'file')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg-git', 'pkg')).toBe('pkg:git');
    expect(migrateStateId('link-~/.config/nvim', 'link')).toBe('link:~/.config/nvim');
    expect(migrateStateId('dir-~/.config', 'dir')).toBe('dir:~/.config');
    expect(migrateStateId('remote-/tmp/bin', 'remote')).toBe('remote:/tmp/bin');
    expect(migrateStateId('git-/tmp/dotts', 'git')).toBe('git:/tmp/dotts');
    expect(migrateStateId('service-sshd', 'service')).toBe('service:sshd');
    expect(migrateStateId('user-brimmar', 'user')).toBe('user:brimmar');
    expect(migrateStateId('group-sudo', 'group')).toBe('group:sudo');
    expect(migrateStateId('apt-repo-nodejs', 'apt-repo')).toBe('apt-repo:nodejs');
    expect(migrateStateId('unarchive-tools', 'unarchive')).toBe('unarchive:tools');
  });

  it('does not rewrite script or line hash ids', () => {
    expect(migrateStateId('script-echo hello', 'script')).toBe('script-echo hello');
    expect(migrateStateId('line-/tmp/a-export', 'line')).toBe('line-/tmp/a-export');
    expect(migrateStateId('script:abc123', 'script')).toBe('script:abc123');
    expect(migrateStateId('line:/tmp/a:deadbeef', 'line')).toBe('line:/tmp/a:deadbeef');
  });

  it('does not rewrite when stored kind does not match the prefix', () => {
    expect(migrateStateId('file-/tmp/a', 'pkg')).toBe('file-/tmp/a');
    expect(migrateStateId('file-/tmp/a', 'test')).toBe('file-/tmp/a');
    expect(migrateStateId('pkg-git', 'git')).toBe('pkg-git');
  });

  it('does not rewrite when kind is missing', () => {
    expect(migrateStateId('file-/tmp/a')).toBe('file-/tmp/a');
    expect(migrateStateId('pkg-git')).toBe('pkg-git');
  });

  it('leaves colon-form ids unchanged', () => {
    expect(migrateStateId('file:/tmp/a', 'file')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg:git', 'pkg')).toBe('pkg:git');
    expect(migrateStateId('service:sshd', 'service')).toBe('service:sshd');
    expect(migrateStateId('apt-repo:nodejs', 'apt-repo')).toBe('apt-repo:nodejs');
  });

  it('leaves unrelated ids unchanged', () => {
    expect(migrateStateId('gone', 'test')).toBe('gone');
    expect(migrateStateId('res-1', 'test')).toBe('res-1');
  });
});

describe('migrateStateKeys', () => {
  it('rewrites a hyphen key when stored kind matches and the colon key is absent', () => {
    const migrated = migrateStateKeys({
      'file-/tmp/x': { hash: 'old', kind: 'file' },
      gone: { hash: 'keep', kind: 'test' },
    });
    expect(migrated['file:/tmp/x']).toEqual({ hash: 'old', kind: 'file' });
    expect(migrated['file-/tmp/x']).toBeUndefined();
    expect(migrated.gone).toEqual({ hash: 'keep', kind: 'test' });
  });

  it('keeps the hyphen key when the colon form already exists', () => {
    const migrated = migrateStateKeys({
      'file-/tmp/x': { hash: 'old', kind: 'file' },
      'file:/tmp/x': { hash: 'new', kind: 'file' },
    });
    expect(migrated['file:/tmp/x']).toEqual({ hash: 'new', kind: 'file' });
    expect(migrated['file-/tmp/x']).toEqual({ hash: 'old', kind: 'file' });
  });

  it('does not rewrite hyphen keys whose stored kind does not match', () => {
    const migrated = migrateStateKeys({
      'file-/tmp/x': { hash: 'old', kind: 'pkg' },
    });
    expect(migrated['file-/tmp/x']).toEqual({ hash: 'old', kind: 'pkg' });
    expect(migrated['file:/tmp/x']).toBeUndefined();
  });

  it('does not rewrite script or line keys', () => {
    const migrated = migrateStateKeys({
      'script-echo hello': { hash: 's', kind: 'script' },
      'line-/tmp/a-export': { hash: 'l', kind: 'line' },
    });
    expect(migrated['script-echo hello']).toEqual({ hash: 's', kind: 'script' });
    expect(migrated['line-/tmp/a-export']).toEqual({ hash: 'l', kind: 'line' });
  });
});

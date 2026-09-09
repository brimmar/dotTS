import { describe, expect, it } from 'bun:test';
import { migrateStateId, migrateStateKeys } from './ids';

describe('migrateStateId', () => {
  it('converts hyphen prefixes to colon form', () => {
    expect(migrateStateId('file-/tmp/a')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg-git')).toBe('pkg:git');
    expect(migrateStateId('link-~/.config/nvim')).toBe('link:~/.config/nvim');
    expect(migrateStateId('dir-~/.config')).toBe('dir:~/.config');
    expect(migrateStateId('script-echo hello')).toBe('script:echo hello');
    expect(migrateStateId('remote-/tmp/bin')).toBe('remote:/tmp/bin');
    expect(migrateStateId('git-/tmp/dotts')).toBe('git:/tmp/dotts');
    expect(migrateStateId('line-/tmp/a-export')).toBe('line:/tmp/a-export');
    expect(migrateStateId('service-sshd')).toBe('service:sshd');
    expect(migrateStateId('user-brimmar')).toBe('user:brimmar');
    expect(migrateStateId('group-sudo')).toBe('group:sudo');
    expect(migrateStateId('apt-repo-nodejs')).toBe('apt-repo:nodejs');
    expect(migrateStateId('unarchive-tools')).toBe('unarchive:tools');
  });

  it('leaves colon-form ids unchanged', () => {
    expect(migrateStateId('file:/tmp/a')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg:git')).toBe('pkg:git');
    expect(migrateStateId('service:sshd')).toBe('service:sshd');
    expect(migrateStateId('apt-repo:nodejs')).toBe('apt-repo:nodejs');
  });

  it('leaves unrelated ids unchanged', () => {
    expect(migrateStateId('gone')).toBe('gone');
    expect(migrateStateId('res-1')).toBe('res-1');
  });
});

describe('migrateStateKeys', () => {
  it('rewrites hyphen keys and prefers an existing colon key', () => {
    const migrated = migrateStateKeys({
      'file-/tmp/x': { hash: 'old' },
      'file:/tmp/x': { hash: 'new' },
      gone: { hash: 'keep' },
    });
    expect(migrated['file:/tmp/x']).toEqual({ hash: 'new' });
    expect(migrated['file-/tmp/x']).toBeUndefined();
    expect(migrated.gone).toEqual({ hash: 'keep' });
  });
});

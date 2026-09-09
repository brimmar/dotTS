import { describe, expect, it } from 'bun:test';
import { migrateStateId } from './ids';

describe('migrateStateId', () => {
  it('converts hyphen prefixes to colon form', () => {
    expect(migrateStateId('file-/tmp/a')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg-git')).toBe('pkg:git');
    expect(migrateStateId('link-~/.config/nvim')).toBe('link:~/.config/nvim');
    expect(migrateStateId('dir-~/.config')).toBe('dir:~/.config');
    expect(migrateStateId('script-echo hello')).toBe('script:echo hello');
  });

  it('leaves colon-form ids unchanged', () => {
    expect(migrateStateId('file:/tmp/a')).toBe('file:/tmp/a');
    expect(migrateStateId('pkg:git')).toBe('pkg:git');
    expect(migrateStateId('service:sshd')).toBe('service:sshd');
  });

  it('leaves unrelated ids unchanged', () => {
    expect(migrateStateId('apt-repo:nodejs')).toBe('apt-repo:nodejs');
    expect(migrateStateId('git:/tmp/dotts')).toBe('git:/tmp/dotts');
  });
});

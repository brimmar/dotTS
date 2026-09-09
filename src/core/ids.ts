const LEGACY_PREFIXES = [
  'apt-repo',
  'unarchive',
  'service',
  'script',
  'remote',
  'group',
  'user',
  'file',
  'link',
  'line',
  'pkg',
  'dir',
  'git',
] as const;

/**
 * Maps pre-colon resource ids (`file-/tmp/a`) to the current `kind:name` form
 * (`file:/tmp/a`). Call this when reading state keys so old hashes still match.
 * New writes should use the colon form as-is.
 */
export function migrateStateId(id: string): string {
  for (const prefix of LEGACY_PREFIXES) {
    const hyphen = `${prefix}-`;
    if (id.startsWith(hyphen)) {
      return `${prefix}:${id.slice(hyphen.length)}`;
    }
  }
  return id;
}

/**
 * Rewrites loaded state keys to colon form. If both `file-/tmp/a` and
 * `file:/tmp/a` exist, the colon key's hash is kept.
 */
export function migrateStateKeys<T>(state: Record<string, T>): Record<string, T> {
  const migrated: Record<string, T> = {};
  for (const [id, value] of Object.entries(state)) {
    if (migrateStateId(id) === id) {
      migrated[id] = value;
    }
  }
  for (const [id, value] of Object.entries(state)) {
    const newId = migrateStateId(id);
    if (newId === id) continue;
    if (newId in migrated) continue;
    migrated[newId] = value;
  }
  return migrated;
}

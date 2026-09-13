const ONE_TO_ONE_KINDS = new Set([
  'apt-repo',
  'unarchive',
  'service',
  'remote',
  'group',
  'user',
  'file',
  'link',
  'pkg',
  'dir',
  'git',
]);

function storedKind(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : undefined;
}

/**
 * Maps pre-colon resource ids (`file-/tmp/a`) to the current `kind:name` form
 * (`file:/tmp/a`) when `kind` is a 1:1 prefix. Script and line ids are hashes
 * and must not be rewritten. Call this when reading state keys so old hashes
 * still match. New writes should use the colon form as-is.
 */
export function migrateStateId(id: string, kind?: string): string {
  if (!kind || kind === 'script' || kind === 'line') return id;
  if (!ONE_TO_ONE_KINDS.has(kind)) return id;
  const hyphen = `${kind}-`;
  if (!id.startsWith(hyphen)) return id;
  return `${kind}:${id.slice(hyphen.length)}`;
}

/**
 * Rewrites loaded state keys to colon form when the stored kind matches the
 * hyphen prefix. If both `file-/tmp/a` and `file:/tmp/a` exist, both keys are
 * kept so the hyphen leftover can be merged or destroyed on purpose.
 */
export function migrateStateKeys<T>(state: Record<string, T>): Record<string, T> {
  const migrated: Record<string, T> = {};
  const pending: [string, T, string][] = [];

  for (const [id, value] of Object.entries(state)) {
    const newId = migrateStateId(id, storedKind(value));
    if (newId === id) {
      migrated[id] = value;
    } else {
      pending.push([id, value, newId]);
    }
  }

  for (const [id, value, newId] of pending) {
    if (newId in migrated) {
      migrated[id] = value;
    } else {
      migrated[newId] = value;
    }
  }

  return migrated;
}

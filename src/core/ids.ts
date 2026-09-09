const LEGACY_PREFIXES = ['file', 'pkg', 'link', 'dir', 'script'] as const;

/**
 * Maps pre-colon resource ids (`file-/tmp/a`) to the current `kind:name` form
 * (`file:/tmp/a`). Call this when reading state keys so old hashes still match.
 * New writes should use the colon form as-is.
 *
 * Stack 80 (runner converge/destroy) should apply this to loaded state keys.
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

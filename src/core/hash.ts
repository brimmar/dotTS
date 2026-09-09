import { createHash } from 'node:crypto';
import { SecretToken } from './secret';

export function hashConfig(config: unknown): string {
  const normalized = normalize(config, new WeakSet<object>());
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function isResourceLike(value: object): value is { id: string } {
  const record = value as Record<string, unknown>;
  return record.isResource === true && typeof record.id === 'string';
}

function normalize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'object') {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return undefined;
  }

  if (value instanceof SecretToken) {
    return { $secret: value.name };
  }

  if (isResourceLike(value)) {
    return { $ref: value.id };
  }

  // Path of the current walk. Delete after recurse so DAG aliases are
  // rehashed; only back-edges become { $cycle: true }.
  if (seen.has(value)) {
    return { $cycle: true };
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalize(item, seen));
    }

    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const keys = Object.keys(record).sort();
    for (const key of keys) {
      const nested = record[key];
      if (nested === undefined || typeof nested === 'function') {
        continue;
      }
      result[key] = normalize(nested, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

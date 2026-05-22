import { createHash } from 'node:crypto';

export function hashConfig(config: any): string {
  const normalized = normalize(config);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function normalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(normalize);
  }

  const sortedKeys = Object.keys(obj).sort();
  const result: any = {};
  for (const key of sortedKeys) {
    result[key] = normalize(obj[key]);
  }
  return result;
}

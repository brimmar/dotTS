import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { Resource } from './component';

export function sortResources(resources: Resource[]): Resource[] {
  const sorted: Resource[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(res: Resource) {
    if (visiting.has(res.id)) {
      throw new Error(`Circular dependency detected: ${res.id} is part of a cycle.`);
    }
    if (!visited.has(res.id)) {
      visiting.add(res.id);
      
      // visit dependencies
      for (const dep of res.dependencies) {
        if (dep instanceof Resource) {
          visit(dep);
        }
      }

      visiting.delete(res.id);
      visited.add(res.id);
      sorted.push(res);
    }
  }

  for (const res of resources) {
    visit(res);
  }

  return sorted;
}

export function sortResourcesByTier(resources: Resource[]): Resource[][] {
  const tiers: Resource[][] = [];
  const remaining = new Set(resources);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    const currentTier: Resource[] = [];
    
    for (const res of remaining) {
      const allDepsMet = res.dependencies.every(dep => {
        if (dep instanceof Resource) {
          // If the dependency is in the initial resource list, it must be completed.
          // If it's NOT in the list, we assume it's external/already satisfied or will be handled.
          // For dotts, all resources should be in the list.
          return !resources.find(r => r.id === dep.id) || completed.has(dep.id);
        }
        return true;
      });

      if (allDepsMet) {
        currentTier.push(res);
      }
    }

    if (currentTier.length === 0) {
      // If we have remaining nodes but none can be picked, there's a cycle.
      // We can use the existing sortResources to trigger the error with cycle details.
      sortResources(Array.from(remaining));
      throw new Error('Circular dependency detected');
    }

    tiers.push(currentTier);
    for (const res of currentTier) {
      completed.add(res.id);
      remaining.delete(res);
    }
  }

  return tiers;
}

function resolveManagedPath(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return `${homedir()}${p.slice(1)}`;
  return resolve(p);
}

export function resourceManagedPath(props: unknown): string | undefined {
  if (typeof props !== 'object' || props === null) return undefined;
  const record = props as Record<string, unknown>;
  const raw = record.path !== undefined ? record.path : record.dest;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return resolveManagedPath(raw);
}

export function isPathWithin(parent: string, child: string, options?: { strict?: boolean }): boolean {
  const rel = relative(parent, child);
  if (rel === '') return options?.strict !== true;
  if (isAbsolute(rel)) return false;
  return !rel.startsWith('..');
}

function dependencyIds(res: Resource): string[] {
  const ids: string[] = [];
  for (const dep of res.dependencies) {
    if (typeof dep.id === 'string' && dep.id.length > 0) {
      ids.push(dep.id);
    }
  }
  return ids;
}

export function sortDestroyResources(resources: Resource[]): Resource[] {
  const inSet = new Set(resources.map((r) => r.id));
  const byId = new Map(resources.map((r) => [r.id, r]));
  const sorted: Resource[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function depsOf(res: Resource): Resource[] {
    const depIds = new Set<string>();
    for (const id of dependencyIds(res)) {
      if (inSet.has(id)) depIds.add(id);
    }
    const path = resourceManagedPath(res.props);
    if (path) {
      for (const other of resources) {
        if (other.id === res.id) continue;
        const otherPath = resourceManagedPath(other.props);
        if (otherPath && isPathWithin(otherPath, path, { strict: true })) {
          depIds.add(other.id);
        }
      }
    }
    const deps: Resource[] = [];
    for (const id of depIds) {
      const dep = byId.get(id);
      if (dep) deps.push(dep);
    }
    return deps;
  }

  function visit(res: Resource) {
    if (visiting.has(res.id)) {
      throw new Error(`Circular dependency detected: ${res.id} is part of a cycle.`);
    }
    if (!visited.has(res.id)) {
      visiting.add(res.id);
      for (const dep of depsOf(res)) {
        visit(dep);
      }
      visiting.delete(res.id);
      visited.add(res.id);
      sorted.push(res);
    }
  }

  for (const res of resources) {
    visit(res);
  }

  return sorted.reverse();
}
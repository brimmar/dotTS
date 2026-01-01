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
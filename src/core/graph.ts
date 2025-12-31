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
        } else {
          // If a component is a dependency, we should ideally visit all its resources.
          // For now, we only support Resource-level dependsOn for simplicity.
        }
      }

      visiting.delete(res.id);
      visited.add(res.id);
      sorted.push(res);
    }
  }

  // Ensure all resources are visited
  for (const res of resources) {
    visit(res);
  }

  return sorted;
}

import { describe, it, expect } from 'bun:test';
import { resolve } from 'node:path';
import { Resource, Component } from './component';
import { isPathWithin, resourceManagedPath, sortDestroyResources, sortResources, sortResourcesByTier } from './graph';
import { Effect } from 'effect';

class MockResource extends Resource {
  override readonly kind = 'test' as const;
  constructor(scope: any, id: string, props?: any) {
    super(scope, id, props);
  }
  apply() { return Effect.void; }
  destroy() { return Effect.void; }
  hash() { return 'hash'; }
}

describe('Graph Engine', () => {
  it('should sort resources based on dependencies', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    const r1 = new MockResource(parent, 'r1');
    const r2 = new MockResource(parent, 'r2', { dependsOn: [r1] });
    const r3 = new MockResource(parent, 'r3', { dependsOn: [r2] });

    const sorted = sortResources([r3, r1, r2]);
    expect(sorted.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('should handle branching dependencies', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    const r1 = new MockResource(parent, 'r1');
    const r2 = new MockResource(parent, 'r2', { dependsOn: [r1] });
    const r3 = new MockResource(parent, 'r3', { dependsOn: [r1] });
    const r4 = new MockResource(parent, 'r4', { dependsOn: [r2, r3] });

    const sorted = sortResources([r4, r3, r2, r1]);
    const ids = sorted.map(r => r.id);
    expect(ids.indexOf('r1')).toBeLessThan(ids.indexOf('r2'));
    expect(ids.indexOf('r1')).toBeLessThan(ids.indexOf('r3'));
    expect(ids.indexOf('r2')).toBeLessThan(ids.indexOf('r4'));
    expect(ids.indexOf('r3')).toBeLessThan(ids.indexOf('r4'));
  });

  it('should throw an error on cyclic dependencies', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    const r1 = new MockResource(parent, 'r1');
    const r2 = new MockResource(parent, 'r2', { dependsOn: [r1] });
    r1.addDependency(r2); // Cycle!

    expect(() => sortResources([r1, r2])).toThrow(/Circular dependency detected/);
  });

  it('should group resources into execution tiers', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    
    const r1 = new MockResource(parent, 'r1');
    const r2 = new MockResource(parent, 'r2');
    const r3 = new MockResource(parent, 'r3', { dependsOn: [r1] });
    const r4 = new MockResource(parent, 'r4', { dependsOn: [r1] });
    const r5 = new MockResource(parent, 'r5', { dependsOn: [r3, r4] });

    // Tiers should be:
    // Tier 0: [r1, r2] (no dependencies)
    // Tier 1: [r3, r4] (depends on r1)
    // Tier 2: [r5] (depends on r3, r4)

    const tiers = sortResourcesByTier([r1, r2, r3, r4, r5]);
    
    expect(tiers.length).toBe(3);
    expect(tiers[0]).toContain(r1);
    expect(tiers[0]).toContain(r2);
    expect(tiers[1]).toContain(r3);
    expect(tiers[1]).toContain(r4);
    expect(tiers[2]).toContain(r5);
  });

  it('should destroy dependents before dependencies', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    const r1 = new MockResource(parent, 'r1');
    const r2 = new MockResource(parent, 'r2', { dependsOn: [r1] });
    const r3 = new MockResource(parent, 'r3', { dependsOn: [r2] });

    expect(sortDestroyResources([r1, r2, r3]).map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
  });

  it('should destroy nested paths before their parents', () => {
    const parent = new class extends Component { constructor() { super('root'); } };
    const dir = new MockResource(parent, 'dir', { path: '/tmp/parent' });
    const file = new MockResource(parent, 'file', { path: '/tmp/parent/child' });

    expect(sortDestroyResources([dir, file]).map((r) => r.id)).toEqual(['file', 'dir']);
  });

  it('should resolve path and dest from resource props', () => {
    expect(resourceManagedPath({ path: '/tmp/a' })).toBe(resolve('/tmp/a'));
    expect(resourceManagedPath({ dest: '/tmp/b' })).toBe(resolve('/tmp/b'));
    expect(resourceManagedPath({})).toBeUndefined();
  });

  it('should treat a path as within its parent', () => {
    expect(isPathWithin('/tmp/parent', '/tmp/parent/child')).toBe(true);
    expect(isPathWithin('/tmp/parent', '/tmp/parent')).toBe(true);
    expect(isPathWithin('/tmp/parent', '/tmp/parent', { strict: true })).toBe(false);
    expect(isPathWithin('/tmp/parent', '/tmp/other')).toBe(false);
  });
});
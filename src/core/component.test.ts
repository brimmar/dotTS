import { describe, it, expect } from 'bun:test';
import { Effect } from 'effect';
import { Component, Resource, type ResourceHandle } from './component';
import { App, Stack } from './app';

class TestResource extends Resource {
  constructor(scope: Component, id: string, props?: { dependsOn?: ResourceHandle[] }) {
    super(scope, id, props);
  }
  apply() { return Effect.void; }
  destroy() { return Effect.void; }
  hash() { return 'hash'; }
}

class TestComponent extends Component {
  constructor(id: string) {
    super(id);
    new TestResource(this, `${id}-resource`);
  }
}

describe('Component Architecture', () => {
  it('should allow components to have children', () => {
    const component = new TestComponent('root');
    expect(component.children.length).toBe(1);
    expect(component.children[0]).toBeInstanceOf(Resource);
  });

  it('should identify resources correctly', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');
    expect(res.isResource).toBe(true);
  });

  it('should allow adding dependencies', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res1 = new TestResource(stack, 'res-1');
    const res2 = new TestResource(stack, 'res-2');
    
    res2.addDependency(res1);
    expect(res2.dependencies).toContain(res1);
  });

  it('should support dependsOn in Resource constructor', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res1 = new TestResource(stack, 'res-1');
    const res2 = new TestResource(stack, 'res-2', { dependsOn: [res1] });
    
    expect(res2.dependencies).toContain(res1);
  });

  it('Resource is a ResourceHandle', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res = new TestResource(stack, 'res-1');
    const handle: ResourceHandle = res;
    expect(handle.id).toBe('res-1');
  });

  it('resolves dependsOn by id when the handle is not a Component', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    const res1 = new TestResource(stack, 'res-1');
    const res2 = new TestResource(stack, 'res-2', { dependsOn: [{ id: res1.id }] });

    expect(res2.dependencies).toContain(res1);
  });

  it('throws when dependsOn id is not a live resource', () => {
    const app = new App();
    const stack = new Stack(app, 'test');

    expect(() => new TestResource(stack, 'res-2', { dependsOn: [{ id: 'missing' }] })).toThrow(
      "dependsOn target 'missing' is not a live resource in this stack",
    );
  });
});

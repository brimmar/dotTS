import { describe, it, expect } from 'bun:test';
import { Component, Resource } from './component';

class TestResource extends Resource {
  constructor(scope: Component, id: string) {
    super(scope, id);
  }
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
    const root = new TestComponent('root');
    const resource = new TestResource(root, 'res');
    expect(resource.isResource).toBe(true);
    expect(root.children).toContain(resource);
  });
});

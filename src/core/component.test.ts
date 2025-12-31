import { describe, it, expect } from 'bun:test';
import { Component, Resource } from './component';

class TestResource extends Resource {
  constructor(id: string) {
    super(id);
  }
}

class TestComponent extends Component {
  constructor(id: string) {
    super(id);
    this.add(new TestResource(`${id}-resource`));
  }
}

describe('Component Architecture', () => {
  it('should allow components to have children', () => {
    const component = new TestComponent('root');
    expect(component.children.length).toBe(1);
    expect(component.children[0]).toBeInstanceOf(Resource);
  });

  it('should identify resources correctly', () => {
    const resource = new TestResource('res');
    expect(resource.isResource).toBe(true);
  });
});

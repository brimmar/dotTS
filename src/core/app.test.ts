import { describe, it, expect } from 'bun:test';
import { App, Stack } from './app';
import { Component } from './component';

class TestComponent extends Component {
  constructor(id: string) {
    super(id);
  }
}

describe('App & Stack', () => {
  it('should allow stacks to be added to an app', () => {
    const app = new App();
    const stack = new Stack(app, 'my-stack');
    
    expect(app.children).toContain(stack);
    expect(stack.id).toBe('my-stack');
  });

  it('should allow components to be added to a stack', () => {
    const app = new App();
    const stack = new Stack(app, 'dev');
    const component = new TestComponent('git');
    
    stack.add(component);
    
    expect(stack.children).toContain(component);
  });
});

import { describe, it, expect } from 'bun:test';
import { ActiveContext } from './context';
import { App, Stack } from './app';

describe('ActiveContext', () => {
  it('should track and return the active stack', () => {
    const app = new App();
    const stack = new Stack(app, 'test');
    
    ActiveContext.setStack(stack);
    expect(ActiveContext.getStack()).toBe(stack);
    
    ActiveContext.clear();
    expect(ActiveContext.getStack()).toBeUndefined();
  });

  it('should throw if getting stack when none is set', () => {
    ActiveContext.clear();
    expect(() => ActiveContext.requireStack()).toThrow(/No active stack found/);
  });
});

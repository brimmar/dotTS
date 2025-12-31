import { describe, it, expect } from 'bun:test';
import { hashConfig } from './hash';

describe('Hashing Utility', () => {
  it('should generate consistent hashes for identical objects', () => {
    const obj1 = { path: '/tmp/test', content: 'hello' };
    const obj2 = { path: '/tmp/test', content: 'hello' };
    
    expect(hashConfig(obj1)).toBe(hashConfig(obj2));
  });

  it('should generate different hashes for different objects', () => {
    const obj1 = { path: '/tmp/test', content: 'hello' };
    const obj2 = { path: '/tmp/test', content: 'world' };
    
    expect(hashConfig(obj1)).not.toBe(hashConfig(obj2));
  });

  it('should handle nested objects consistently', () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { b: { c: 2 }, a: 1 }; // Keys in different order
    
    expect(hashConfig(obj1)).toBe(hashConfig(obj2));
  });
});

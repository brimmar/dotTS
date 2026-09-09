import { describe, it, expect } from 'bun:test';
import { hashConfig } from './hash';
import { SecretToken } from './secret';

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

  it('same plain object with different key order yields the same hash', () => {
    const left = { path: '/tmp/a', mode: 0o644, content: 'x' };
    const right = { content: 'x', path: '/tmp/a', mode: 0o644 };

    expect(hashConfig(left)).toBe(hashConfig(right));
  });

  it('dependsOn identity ignored: same resource id hashes equal regardless of other fields', () => {
    const left = {
      path: '/tmp/a',
      dependsOn: [{ id: 'pkg', isResource: true, children: [], extra: 'one' }],
    };
    const right = {
      path: '/tmp/a',
      dependsOn: [
        {
          id: 'pkg',
          isResource: true,
          children: [{ id: 'other' }],
          extra: 'two',
          props: { n: 1 },
        },
      ],
    };

    expect(hashConfig(left)).toBe(hashConfig(right));
    expect(hashConfig({ dependsOn: [{ id: 'a', isResource: true }] })).not.toBe(
      hashConfig({ dependsOn: [{ id: 'b', isResource: true }] }),
    );
  });

  it('adding a child to a depended-on resource does not change the dependent hash', () => {
    const dep = { id: 'dep', isResource: true, children: [] as unknown[] };
    const props = { path: '/tmp/file', dependsOn: [dep] };
    const before = hashConfig(props);

    dep.children.push({ id: 'child', isResource: true });

    expect(hashConfig(props)).toBe(before);
  });

  it('SecretToken by name: same name hashes equal, different name differs', () => {
    const sameA = { content: new SecretToken('db') };
    const sameB = { content: new SecretToken('db') };
    const other = { content: new SecretToken('api') };

    expect(hashConfig(sameA)).toBe(hashConfig(sameB));
    expect(hashConfig(sameA)).not.toBe(hashConfig(other));
    expect(hashConfig(new SecretToken('db'))).toBe(hashConfig(new SecretToken('db')));
    expect(hashConfig(new SecretToken('db'))).not.toBe(hashConfig(new SecretToken('api')));
  });

  it('shared DAG objects hash equal to two deep-equal copies', () => {
    const shared = { x: 1, nested: { y: 2 } };
    const dag = { a: shared, b: shared };
    const copies = { a: { x: 1, nested: { y: 2 } }, b: { x: 1, nested: { y: 2 } } };

    expect(hashConfig(dag)).toBe(hashConfig(copies));
  });

  it('does not hang on circular dependsOn cycles', () => {
    const a: Record<string, unknown> = { id: 'a', isResource: true, children: [] };
    const b: Record<string, unknown> = { id: 'b', isResource: true, children: [] };
    a.dependsOn = [b];
    b.dependsOn = [a];

    expect(() => hashConfig({ path: '/x', dependsOn: [a] })).not.toThrow();
    expect(hashConfig({ path: '/x', dependsOn: [a] })).toBe(
      hashConfig({ path: '/x', dependsOn: [{ id: 'a', isResource: true }] }),
    );

    const loop: Record<string, unknown> = { path: '/loop' };
    loop.dependsOn = [loop];
    expect(() => hashConfig(loop)).not.toThrow();
  });
});

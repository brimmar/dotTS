import { describe, it, expect } from 'bun:test';
import { App } from './app';
import { rehydrate, registerResource, resourceFactories } from './registry';
import { PackageResource } from '../resources/package';
import { FileResource } from '../resources/file';
import { UnarchiveResource } from '../resources/unarchive';
import { Resource, Component } from './component';
import { Effect } from 'effect';

describe('registry', () => {
  const kinds = [
    'pkg',
    'file',
    'link',
    'dir',
    'script',
    'remote',
    'git',
    'line',
    'service',
    'user',
    'group',
    'apt-repo',
    'unarchive',
  ];

  it('registers a factory for every resource kind', () => {
    for (const kind of kinds) {
      expect(resourceFactories[kind]).toBeDefined();
    }
  });

  it('rehydrates a package resource from kind and metadata', () => {
    const scope = new App();
    const res = rehydrate('pkg', 'pkg-git', { name: 'git' }, scope);
    expect(res).toBeInstanceOf(PackageResource);
    expect(res.kind).toBe('pkg');
    expect(res.id).toBe('pkg-git');
  });

  it('rehydrates a file resource from kind and metadata', () => {
    const scope = new App();
    const res = rehydrate('file', 'file-/tmp/a', { path: '/tmp/a', content: '' }, scope);
    expect(res).toBeInstanceOf(FileResource);
    expect(res.kind).toBe('file');
  });

  it('rehydrates unarchive without deleting dest on destroy', async () => {
    const scope = new App();
    const res = rehydrate('unarchive', 'unarchive-1', { src: '/tmp/a.tgz', dest: '/tmp/out' }, scope);
    expect(res).toBeInstanceOf(UnarchiveResource);
    await Effect.runPromise(res.destroy() as Effect.Effect<void, Error, never>);
  });

  it('throws on unknown kind', () => {
    expect(() => rehydrate('not-a-kind', 'id', {}, new App())).toThrow(/Unknown resource kind: not-a-kind/);
  });

  it('allows tests to register extra kinds', () => {
    class ExtraResource extends Resource {
      override readonly kind = 'extra' as const;
      constructor(scope: Component, id: string) {
        super(scope, id, {});
      }
      override apply() { return Effect.void; }
      override destroy() { return Effect.void; }
      override hash() { return 'hash'; }
    }

    registerResource('extra', (scope, id) => new ExtraResource(scope, id));
    const res = rehydrate('extra', 'extra-1', {}, new App());
    expect(res).toBeInstanceOf(ExtraResource);
    delete resourceFactories.extra;
  });
});
